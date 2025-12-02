import React, { useEffect, useState, useRef } from 'react'
import mqtt from 'mqtt/dist/mqtt'
import { Car, Clock, DollarSign, CreditCard } from 'lucide-react'
import ClientVagaCard from './components/ClientVagaCard'
import ClientKPICard from './components/ClientKPICard'
import './styles/client.css'

const BROKER = import.meta.env.VITE_MQTT_BROKER || 'wss://broker.hivemq.com:8884/mqtt'
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function normalizeStatus(raw) {
  if (!raw && raw !== 0) return 'unknown'
  const s = String(raw).toLowerCase().trim()
  if (s === '0' || s === 'livre' || s === 'free' || s === 'liberada' || s === 'liberado') return 'free'
  if (s === '1' || s === 'ocupada' || s === 'ocupado' || s === 'occupied') return 'occupied'
  if (s.includes('ocup')) return 'occupied'
  if (s.includes('libre') || s.includes('livre') || s.includes('free')) return 'free'
  return s
}

export default function ClientDashboard() {
  const [vagas, setVagas] = useState({})
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [clientSession, setClientSession] = useState(null) // { vagaId, startTime, totalPago }
  const clientRef = useRef(null)
  
  const fetchVagasFromAPI = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/spots`)
      
      if (response.ok) {
        const spots = await response.json()
        setLoading(false)
        
        setVagas(prev => {
          const vagasData = {}
          spots.forEach(spot => {
            const currentVaga = prev[spot.nome]
            const newStatus = spot.status
            
            let statusChangeTime
            if (currentVaga && currentVaga.status === newStatus) {
              statusChangeTime = currentVaga.statusChangeTime
            } else {
              statusChangeTime = Date.now()
            }
              
            vagasData[spot.nome] = {
              status: newStatus,
              lastUpdate: Date.now(),
              statusChangeTime: statusChangeTime,
              distancia: spot.distancia,
              esp32_controlled: spot.esp32_controlled
            }
          })
          return vagasData
        })
        
        return spots
      } else {
        throw new Error(`HTTP ${response.status}`)
      }
    } catch (error) {
      setLoading(false)
      return null
    }
  }

  useEffect(() => {
    fetchVagasFromAPI()
    
    const apiInterval = setInterval(() => {
      fetchVagasFromAPI()
    }, 30000)
    
    return () => clearInterval(apiInterval)
  }, [])

  useEffect(() => {
    const client = mqtt.connect(BROKER, { connectTimeout: 4000 })
    clientRef.current = client

    client.on('connect', () => {
      setConnected(true)
      client.subscribe('/vaga1/status')
      client.subscribe('/vaga2/status')
      client.subscribe('vaga/+/status')
      client.subscribe('vaga/+/distancia')
    })

    client.on('message', (topic, message) => {
      const payload = message.toString()
      handleMessage(topic, payload)
    })

    client.on('error', () => {})
    client.on('close', () => setConnected(false))

    return () => {
      if (client) client.end()
    }
  }, [])

  function handleMessage(topic, payload) {
    try {
      if (topic === '/vaga1/status') {
        const data = JSON.parse(payload)
        const nome = 'A1'
        updateVagaFromMQTT(nome, data)
        return
      }
      
      if (topic === '/vaga2/status') {
        const data = JSON.parse(payload)
        const nome = 'A2'
        updateVagaFromMQTT(nome, data)
        return
      }
      
      const parts = topic.split('/')
      if (parts.length < 3) return
      const [, nome, tipo] = parts

      if (tipo === 'status') {
        const norm = normalizeStatus(payload)
        updateVagaStatus(nome, norm)
      }
    } catch (error) {
      console.error('Erro MQTT:', error)
    }
  }

  function updateVagaFromMQTT(nome, data) {
    setVagas(prev => {
      const next = { ...prev }
      const current = { ...(next[nome] || { status: 'unknown', statusChangeTime: Date.now() }) }
      
      let newStatus = current.status
      const situacao = data.situacao || ''
      
      if (typeof situacao === 'string') {
        const situacaoLower = situacao.toLowerCase().trim()
        if (situacaoLower === 'ocupada') {
          newStatus = 'occupied'
        } else if (situacaoLower === 'liberada') {
          newStatus = 'free'
        }
      }
      
      if (current.status !== newStatus) {
        current.statusChangeTime = Date.now()
      }
      
      current.status = newStatus
      current.distancia = data.distancia_atual
      current.lastUpdate = Date.now()
      next[nome] = current
      
      return next
    })
  }

  function updateVagaStatus(nome, status) {
    setVagas(prev => {
      const next = { ...prev }
      const current = { ...(next[nome] || { status: 'unknown', statusChangeTime: Date.now() }) }

      if (current.status !== status) {
        current.statusChangeTime = Date.now()
      }
      current.status = status
      current.lastUpdate = Date.now()
      next[nome] = current
      
      return next
    })
  }

  const ocuparVaga = async (vagaId) => {
    try {
      const response = await fetch(`${API_BASE}/api/client/occupy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: 'default',
          vaga_id: vagaId
        })
      })
      
      if (response.ok) {
        setClientSession({
          vagaId: vagaId,
          startTime: Date.now(),
          totalPago: 10
        })
      }
    } catch (error) {
      console.error('Erro ao ocupar vaga:', error)
    }
  }

  const pagarELiberar = async () => {
    if (!clientSession) return
    
    try {
      const response = await fetch(`${API_BASE}/api/client/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: 'default'
        })
      })
      
      if (response.ok) {
        setClientSession(null)
      }
    } catch (error) {
      console.error('Erro ao pagar:', error)
    }
  }

  // Calcula valor total baseado no tempo
  const calcularTotal = () => {
    if (!clientSession) return 10
    
    const tempoDecorrido = Date.now() - clientSession.startTime
    const horas = Math.floor(tempoDecorrido / (1000 * 60 * 60))
    const minutosExtra = Math.floor((tempoDecorrido % (1000 * 60 * 60)) / (1000 * 60))
    
    // R$ 10 inicial + R$ 2 por hora iniciada
    return 10 + (horas * 2) + (minutosExtra > 0 ? 2 : 0)
  }

  const nomes = Object.keys(vagas).sort()
  const total = nomes.length
  const livres = nomes.filter(n => vagas[n].status === 'free').length
  const ocupadas = total - livres
  const taxaOcupacao = total > 0 ? Math.round((ocupadas / total) * 100) : 0

  // Filtra vagas disponíveis (exclui a vaga ocupada pelo cliente)
  const vagasDisponiveis = clientSession 
    ? nomes.filter(nome => nome !== clientSession.vagaId && vagas[nome].status === 'free')
    : nomes.filter(nome => vagas[nome].status === 'free')

  // Debug - logs para verificar estado das vagas
  console.log('Vagas:', vagas)
  console.log('Nomes:', nomes)
  console.log('Vagas disponíveis:', vagasDisponiveis)
  console.log('Client session:', clientSession)

  return (
    <div className="client-dashboard">
      <header className="client-header">
        <div className="header-content">
          <div className="logo-section">
            <img src="/SmartParkingLogo1.png" alt="Smart Parking" className="logo" />
            <h1 className="app-title">Smart Parking - Cliente</h1>
          </div>
          <div className="connection-status">
            <div className={`status-indicator ${connected ? 'online' : 'offline'}`}>
              {connected ? 'Online' : 'Offline'}
            </div>
          </div>
        </div>
      </header>

      <main className="client-content">
        {loading && (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Carregando vagas disponíveis...</p>
          </div>
        )}

        {!loading && (
          <>
            <div className="kpi-section">
              <ClientKPICard
                title="Total de Vagas"
                value={total}
                icon={Car}
                color="#1E88E5"
              />
              <ClientKPICard
                title="Taxa de Ocupação"
                value={`${taxaOcupacao}%`}
                subtitle={`${ocupadas} ocupadas`}
                icon={Car}
                color="#6FFFA3"
              />
              <ClientKPICard
                title="Última Atualização"
                value="Agora"
                icon={Clock}
                color="#94a3b8"
              />
              {clientSession && (
                <ClientKPICard
                  title="Total a Pagar"
                  value={`R$ ${calcularTotal()},00`}
                  subtitle="Atualizado em tempo real"
                  icon={DollarSign}
                  color="#ef4444"
                />
              )}
            </div>

            {clientSession ? (
              <section className="client-session">
                <div className="session-info">
                  <h2>Você está estacionado na {clientSession.vagaId}</h2>
                  <div className="session-details">
                    <p>Valor atual: <strong>R$ {calcularTotal()},00</strong></p>
                    <p>Tempo de permanência será calculado até o pagamento</p>
                  </div>
                  <button 
                    className="pay-button"
                    onClick={pagarELiberar}
                  >
                    <CreditCard size={20} />
                    Pagar e Liberar Vaga
                  </button>
                </div>
              </section>
            ) : (
              <section className="vagas-section">
                <div className="section-header">
                  <h2 className="section-title">
                    <Car size={24} />
                    Vagas Disponíveis ({vagasDisponiveis.length})
                  </h2>
                </div>
                
                {vagasDisponiveis.length === 0 ? (
                  <div className="no-vagas">
                    <p>Nenhuma vaga disponível no momento.</p>
                    <p>Aguarde até que uma vaga seja liberada.</p>
                  </div>
                ) : (
                  <div className="client-vagas-grid">
                    {vagasDisponiveis.map(nome => (
                      <ClientVagaCard 
                        key={nome}
                        nome={nome} 
                        data={vagas[nome]}
                        onOcupar={() => ocuparVaga(nome)}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>

      <footer className="client-footer">
        <p>Smart Parking Cliente © 2025</p>
      </footer>
    </div>
  )
}