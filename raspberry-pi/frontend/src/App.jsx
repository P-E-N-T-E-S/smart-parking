import React, { useEffect, useState, useRef } from 'react'
import mqtt from 'mqtt/dist/mqtt' // usar versão browser
import VagaCard from './components/VagaCard'
import ContadorVagas from './components/ContadorVagas'
import StatusTimer from './components/StatusTimer'
import TotalFreeChart from './components/TotalFreeChart'
import './index.css'

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

  // Debug logs
  console.log('API_BASE:', API_BASE)
  console.log('BROKER:', BROKER)
  console.log('Current vagas:', vagas)

  // Função para buscar dados do backend Flask
  const fetchVagasFromAPI = async () => {
    try {
      console.log('Fazendo fetch para:', `${API_BASE}/api/spots`)
      const response = await fetch(`${API_BASE}/api/spots`)
      console.log('Response status:', response.status)
      
      if (response.ok) {
        const spots = await response.json()
        console.log('Spots recebidos:', spots)
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
        
        console.log('Vagas processadas:', vagasData)
        setVagas(vagasData)
        addLog(`Dados carregados do backend: ${spots.length} vagas`)
        
        return spots
      } else {
        throw new Error(`HTTP ${response.status}`)
      }
    } catch (error) {
      console.error('Erro ao buscar dados do backend:', error)
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
      console.error('Erro ao alternar vaga:', error)
      addLog(`Erro ao alternar ${vagaName}: ${error.message}`)
      return false
    }
  }

  useEffect(() => {
    // Primeira busca dos dados do backend
    console.log('Iniciando busca de dados do backend...')
    fetchVagasFromAPI()
    
    // Atualiza dados do backend a cada 30 segundos
    const apiInterval = setInterval(() => {
      console.log('Atualizando dados do backend...')
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
      console.error('Erro ao processar mensagem MQTT:', error)
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
      console.error('Erro ao atualizar histórico:', e)
    }
  }

  const nomes = Object.keys(vagas).sort()
  const total = nomes.length
  const livres = nomes.filter((n) => vagas[n].status === 'free').length

  return (
    <div className="app-root">
      <header className="app-header">
        <h1>Smart Parking - Dashboard</h1>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <ContadorVagas livres={livres} total={total} />
          <div style={{fontSize:12,color: connected ? '#198754' : '#dc3545' }}>
            MQTT: {connected ? 'conectado' : 'desconectado'}
          </div>
          <div style={{fontSize:12,color: apiConnected ? '#198754' : '#dc3545' }}>
            API: {apiConnected ? 'conectada' : 'desconectada'}
          </div>
        </div>
      </header>

      <main>
        <section className="garage">
          <div className="grid">
            {loading && <p className="placeholder">🔄 Carregando dados do backend API...</p>}
            {!loading && nomes.length === 0 && <p className="placeholder">❌ Nenhuma vaga encontrada. Verifique se o backend está rodando em {API_BASE}</p>}
            {nomes.map((nome) => (
              <div key={nome} style={{display:'flex',flexDirection:'column',alignItems:'stretch',gap:6}}>
                <VagaCard 
                  nome={nome} 
                  data={vagas[nome]} 
                  onToggle={() => toggleVagaAPI(nome)}
                />
                <div style={{marginTop:4}}>
                  <StatusTimer 
                    lastUpdate={vagas[nome]?.statusChangeTime} 
                    status={vagas[nome]?.status} 
                  />
                </div>
              </div>
            ))}
          </div>

          {/* gráfico total de vagas livres */}
          <div style={{marginTop:18}}>
            <h3 style={{margin:'6px 0'}}>Vagas livres ao longo do tempo</h3>
            <TotalFreeChart data={totalSeries.slice(-360)} />
          </div>
        </section>

        <aside className="log">
          <h3>Log de eventos</h3>
          <ul>
            {log.map((item, i) => (
              <li key={i}><strong>{item.time}</strong>: {item.text}</li>
            ))}
          </ul>
        </aside>
      </main>

      <footer className="app-footer">
        <small>Backend API: {API_BASE} | MQTT Broker: {BROKER}</small>
      </footer>
    </div>
  )
}
