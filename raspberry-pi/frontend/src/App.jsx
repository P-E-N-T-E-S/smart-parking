import React, { useEffect, useState, useRef } from 'react'
import mqtt from 'mqtt/dist/mqtt' // usar versão browser
import { Car, TrendingUp, ClipboardList, Activity, Clock, Percent } from 'lucide-react'
import VagaCard from './components/VagaCard'
import DashboardStats from './components/DashboardStats'
import SystemStatus from './components/SystemStatus'
import FreeSpotGauge from './components/FreeSpotGauge'
import KPICard from './components/KPICard'
import OccupancyHeatmap from './components/OccupancyHeatmap'
import TotalFreeChart from './components/TotalFreeChart'
import './styles/modern.css'

// URL do broker WebSocket. Pode ser configurada via Vite env: VITE_MQTT_BROKER
const BROKER = import.meta.env.VITE_MQTT_BROKER || 'wss://broker.hivemq.com:8884/mqtt'

// Configuração do backend Flask
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'

// Função util para normalizar o status recebido
function normalizeStatus(raw) {
  if (!raw && raw !== 0) return 'unknown'
  const s = String(raw).toLowerCase().trim()
  if (s === '0' || s === 'livre' || s === 'free' || s === 'liberada' || s === 'liberado') return 'free'
  if (s === '1' || s === 'ocupada' || s === 'ocupado' || s === 'occupied') return 'occupied'
  // heurística: se tiver "ocup" -> ocupado, se tiver "libre" -> livre
  if (s.includes('ocup')) return 'occupied'
  if (s.includes('libre') || s.includes('livre') || s.includes('free')) return 'free'
  return s
}

export default function App() {
  // vagas: objeto { nome: { status, distancia, lastUpdate } }
  const [vagas, setVagas] = useState({})
  const [log, setLog] = useState([])
  const [connected, setConnected] = useState(false)
  const [apiConnected, setApiConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const clientRef = useRef(null)
  // histórico: mapa vaga -> array de { t, y } onde y=1 ocupado,0 livre
  const historyRef = useRef({})
  // série temporal do total de vagas livres
  const [totalSeries, setTotalSeries] = useState([])

  // Debug logs removidos para produção

  // Função para buscar dados do backend Flask
  const fetchVagasFromAPI = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/spots`)
      
      if (response.ok) {
        const spots = await response.json()
        setApiConnected(true)
        setLoading(false)
        
        // Converte formato do backend para formato do frontend
        const vagasData = {}
        spots.forEach(spot => {
          vagasData[spot.nome] = {
            status: spot.status,
            lastUpdate: Date.now(),
            statusChangeTime: Date.now(), // Quando o status mudou pela última vez
            distancia: spot.distancia,
            esp32_controlled: spot.esp32_controlled
          }
        })
        
        setVagas(vagasData)
        addLog(`Dados carregados do backend: ${spots.length} vagas`)
        
        return spots
      } else {
        throw new Error(`HTTP ${response.status}`)
      }
    } catch (error) {
      setApiConnected(false)
      setLoading(false)
      addLog(`Erro na API: ${error.message}`)
      return null
    }
  }

  // Função para alternar vaga via API do backend
  const toggleVagaAPI = async (vagaName) => {
    try {
      const vagaId = parseInt(vagaName.replace('A', '')) // A1 -> 1, A2 -> 2
      const response = await fetch(`${API_BASE}/api/spots/${vagaId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (response.ok) {
        const result = await response.json()
        addLog(`API Toggle - ${vagaName}: ${result.message}`)
        
        // Atualiza estado local
        setVagas(prev => ({
          ...prev,
          [vagaName]: {
            ...prev[vagaName],
            status: result.occupied ? 'occupied' : 'free',
            lastUpdate: Date.now(),
            statusChangeTime: Date.now() // Status mudou agora
          }
        }))
        
        return true
      } else {
        throw new Error(`HTTP ${response.status}`)
      }
    } catch (error) {
      addLog(`Erro ao alternar ${vagaName}: ${error.message}`)
      return false
    }
  }

  useEffect(() => {
    // Primeira busca dos dados do backend
    fetchVagasFromAPI()
    
    // Atualiza dados do backend a cada 30 segundos
    const apiInterval = setInterval(() => {
      fetchVagasFromAPI()
    }, 30000)
    
    return () => clearInterval(apiInterval)
  }, [])

  useEffect(() => {
    // conectar ao broker via WebSocket para ESP32
    const client = mqtt.connect(BROKER, { connectTimeout: 4000 })
    clientRef.current = client

    client.on('connect', () => {
      setConnected(true)
      addLog(`Conectado ao broker MQTT ${BROKER}`)
      // inscreve no tópico do ESP32 (compatível com backend)
      client.subscribe('/vaga1/status')
      client.subscribe('vaga/+/status')
      client.subscribe('vaga/+/distancia')
    })

    client.on('message', (topic, message) => {
      const payload = message.toString()
      handleMessage(topic, payload)
    })

  client.on('error', (err) => addLog(`Erro MQTT: ${err.message}`))
  client.on('close', () => { setConnected(false); addLog('Conexão MQTT fechada') })
  client.on('reconnect', () => addLog('Tentando reconectar ao broker...'))

    return () => {
      if (client) client.end()
    }
  }, [])

  function addLog(text) {
    setLog((l) => [{ time: new Date().toLocaleString(), text }, ...l].slice(0, 200))
  }

  function handleMessage(topic, payload) {
    // Processa mensagens do ESP32 e outros tópicos MQTT
    try {
      // Tópico ESP32: /vaga1/status
      if (topic === '/vaga1/status') {
        const data = JSON.parse(payload)
        const nome = 'A1'  // Vaga 1 é sempre A1
        
        setVagas((prev) => {
          const next = { ...prev }
          const current = { ...(next[nome] || { status: 'unknown', distancia: null, statusChangeTime: Date.now() }) }
          
          // Processa campo 'situacao' do ESP32
          let newStatus = current.status
          const situacao = data.situacao || ''
          
          if (typeof situacao === 'string') {
            const situacaoLower = situacao.toLowerCase().trim()
            if (situacaoLower === 'ocupada') {
              newStatus = 'occupied'
            } else if (situacaoLower === 'liberada') {
              newStatus = 'free'
            }
          } else {
            // Fallback para lógica de diferença (compatibilidade)
            const diferenca = data.diferenca || 0
            newStatus = diferenca < -2000 ? 'occupied' : diferenca > 2000 ? 'free' : current.status
          }
          
          if (current.status !== newStatus) {
            addLog(`ESP32 - Vaga ${nome}: ${current.status} -> ${newStatus} (situacao: ${situacao})`)
            current.statusChangeTime = Date.now() // Status mudou
          }
          
          current.status = newStatus
          current.distancia = data.distancia_atual
          current.lastUpdate = Date.now()
          next[nome] = current
          
          updateHistory(nome, next)
          return next
        })
        return
      }
      
      // Tópicos padrão: vaga/<nome>/status ou vaga/<nome>/distancia
      const parts = topic.split('/')
      if (parts.length < 3) return
      const [, nome, tipo] = parts

      setVagas((prev) => {
        const next = { ...prev }
        const current = { ...(next[nome] || { status: 'unknown', distancia: null, statusChangeTime: Date.now() }) }

        if (tipo === 'status') {
          const norm = normalizeStatus(payload)
          if (current.status !== norm) {
            addLog(`MQTT - Vaga ${nome}: ${current.status} -> ${norm}`)
            current.statusChangeTime = Date.now() // Status mudou
          }
          current.status = norm
          current.lastUpdate = Date.now()
        } else if (tipo === 'distancia') {
          current.distancia = payload
          current.lastUpdate = Date.now()
        }

        next[nome] = current
        updateHistory(nome, next)
        return next
      })
    } catch (error) {
      addLog(`Erro MQTT: ${error.message}`)
    }
  }

  function updateHistory(nome, vagasState) {
    // Atualiza histórico e série temporal
    try {
      const t = Date.now()
      const hv = historyRef.current
      if (!hv[nome]) hv[nome] = []
      const y = vagasState[nome].status === 'occupied' ? 1 : vagasState[nome].status === 'free' ? 0 : null
      if (y !== null) {
        hv[nome].push({ t, y })
        if (hv[nome].length > 500) hv[nome].shift()
      }

      const nomesNow = Object.keys(vagasState)
      const livresNow = nomesNow.filter((n) => vagasState[n].status === 'free').length
      setTotalSeries((s) => {
        const ns = [...s, { t, y: livresNow }]
        if (ns.length > 1000) ns.shift()
        return ns
      })
    } catch (e) {
      // Silenciar erro de histórico
    }
  }

  const nomes = Object.keys(vagas).sort()
  const total = nomes.length
  const livres = nomes.filter((n) => vagas[n].status === 'free').length
  const ocupadas = total - livres

  // Calcula taxa média de ocupação
  const taxaOcupacao = total > 0 ? Math.round((ocupadas / total) * 100) : 0

  // Última atualização de qualquer vaga
  const lastUpdateTime = nomes.length > 0 
    ? Math.max(...nomes.map(n => vagas[n].lastUpdate || 0))
    : Date.now()
  
  const formatLastUpdate = (timestamp) => {
    if (!timestamp) return 'Nunca'
    const diff = Date.now() - timestamp
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    if (minutes > 60) {
      const hours = Math.floor(minutes / 60)
      return `há ${hours}h ${minutes % 60}m`
    }
    if (minutes > 0) return `há ${minutes}m`
    return `há ${seconds}s`
  }

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="header-content">
          <div className="logo-section">
            <img src="/SmartParkingLogo1.png" alt="Smart Parking" className="logo" />
            <h1 className="app-title">Smart Parking</h1>
          </div>
          <SystemStatus mqttConnected={connected} apiConnected={apiConnected} />
        </div>
      </header>

      <main className="main-content">
        {loading && (
          <div className="loading-container" role="status" aria-live="polite">
            <div className="loading-spinner" aria-hidden="true"></div>
            <p>Carregando dados do sistema...</p>
          </div>
        )}

        {!loading && (
          <>
            {/* Gauge e KPI Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '20px',
              marginBottom: '32px'
            }}>
              <div style={{gridColumn: 'span 1'}}>
                <FreeSpotGauge livres={livres} total={total} />
              </div>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                gridColumn: 'span 1'
              }}>
                <KPICard
                  title="Total de Vagas"
                  value={total}
                  icon={Car}
                  color="#1E88E5"
                />
                <KPICard
                  title="Taxa de Ocupação"
                  value={`${taxaOcupacao}%`}
                  subtitle={`${ocupadas} ocupadas`}
                  icon={Percent}
                  color="#6FFFA3"
                />
                <KPICard
                  title="Última Atualização"
                  value={formatLastUpdate(lastUpdateTime)}
                  icon={Clock}
                  color="#94a3b8"
                />
                <KPICard
                  title="Status do Sistema"
                  value={connected && apiConnected ? 'Online' : 'Offline'}
                  subtitle={connected ? 'MQTT Conectado' : 'MQTT Desconectado'}
                  icon={Activity}
                  color={connected && apiConnected ? '#6FFFA3' : '#ef4444'}
                />
              </div>
            </div>

            <DashboardStats vagas={vagas} />

            <section className="parking-section">
              <div className="section-header">
                <h2 className="section-title">
                  <Car className="section-icon" size={24} strokeWidth={2.5} />
                  Vagas de Estacionamento
                </h2>
              </div>
              
              {nomes.length === 0 ? (
                <div className="placeholder-container" role="alert">
                  <p>Nenhuma vaga encontrada. Verifique se o backend está rodando.</p>
                  <p style={{marginTop:8, fontSize:'0.875rem', color:'var(--text-tertiary)'}}>
                    API: {API_BASE}
                  </p>
                </div>
              ) : (
                <div className="vagas-grid">
                  {nomes.map((nome) => (
                    <VagaCard 
                      key={nome}
                      nome={nome} 
                      data={vagas[nome]} 
                      onToggle={() => toggleVagaAPI(nome)}
                      sparklineData={historyRef.current[nome] || []}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="chart-section">
              <div className="chart-header">
                <h3 className="chart-title">
                  <TrendingUp size={20} strokeWidth={2.5} style={{display:'inline-block', marginRight:8, verticalAlign:'middle'}} />
                  Vagas Livres ao Longo do Tempo
                </h3>
              </div>
              <div className="chart-container">
                <TotalFreeChart data={totalSeries.slice(-360)} />
              </div>
            </section>

            {/* Heatmap de Ocupação */}
            <section className="chart-section" style={{marginTop: '32px'}}>
              <OccupancyHeatmap historyRef={historyRef} />
            </section>

            <section className="log-section">
              <h3 className="log-title">
                <ClipboardList size={20} strokeWidth={2.5} style={{display:'inline-block', marginRight:8, verticalAlign:'middle'}} />
                Log de Eventos
              </h3>
              <ul className="log-list" role="log" aria-live="polite" aria-atomic="false">
                {log.map((item, i) => (
                  <li key={i} className="log-item">
                    <span className="log-time">{item.time}</span>: {item.text}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>

      <footer className="app-footer">
        <p>Smart Parking Dashboard © 2025</p>
        <p style={{marginTop:4, fontSize:'0.75rem'}}>
          Backend: {API_BASE} | MQTT: {BROKER}
        </p>
      </footer>
    </div>
  )
}
