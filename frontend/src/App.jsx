import React, { useEffect, useState, useRef } from 'react'
import mqtt from 'mqtt/dist/mqtt' // usar versão browser
import VagaCard from './components/VagaCard'
import ContadorVagas from './components/ContadorVagas'
import OccupancyChart from './components/OccupancyChart'
import TotalFreeChart from './components/TotalFreeChart'
import './index.css'

// URL do broker WebSocket. Pode ser configurada via Vite env: VITE_MQTT_BROKER
const BROKER = import.meta.env.VITE_MQTT_BROKER || 'ws://localhost:9001'

// Função util para normalizar o status recebido
function normalizeStatus(raw) {
  if (!raw && raw !== 0) return 'unknown'
  const s = String(raw).toLowerCase().trim()
  if (s === '0' || s === 'livre' || s === 'free' || s === 'desocupada') return 'free'
  if (s === '1' || s === 'ocupada' || s === 'ocupado' || s === 'occupied') return 'occupied'
  // heurística: se tiver "ocup" -> ocupado, se tiver "livre" -> livre
  if (s.includes('ocup')) return 'occupied'
  if (s.includes('livre') || s.includes('free')) return 'free'
  return s
}

export default function App() {
  // vagas: objeto { nome: { status, distancia, lastUpdate } }
  const [vagas, setVagas] = useState({})
  const [log, setLog] = useState([])
  const [connected, setConnected] = useState(false)
  const clientRef = useRef(null)
  // histórico: mapa vaga -> array de { t, y } onde y=1 ocupado,0 livre
  const historyRef = useRef({})
  // série temporal do total de vagas livres
  const [totalSeries, setTotalSeries] = useState([])

  useEffect(() => {
    // conectar ao broker via WebSocket
    const client = mqtt.connect(BROKER, { connectTimeout: 4000 })
    clientRef.current = client

    client.on('connect', () => {
      setConnected(true)
      addLog(`Conectado ao broker ${BROKER}`)
      // inscreve nos tópicos para status e distância (todos os nomes de vaga)
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
    // topic esperado: vaga/<nome>/status ou vaga/<nome>/distancia
    const parts = topic.split('/')
    if (parts.length < 3) return
    const [, nome, tipo] = parts

    setVagas((prev) => {
      const next = { ...prev }
      const current = { ...(next[nome] || { status: 'unknown', distancia: null }) }

      if (tipo === 'status') {
        const norm = normalizeStatus(payload)
        if (current.status !== norm) {
          addLog(`Vaga ${nome} mudou: ${current.status} -> ${norm}`)
        }
        current.status = norm
        current.lastUpdate = Date.now()
      } else if (tipo === 'distancia') {
        current.distancia = payload
        current.lastUpdate = Date.now()
      }

      next[nome] = current
      // atualizar histórico: marcar 1 para ocupado, 0 para livre
      try {
        const t = Date.now()
        const hv = historyRef.current
        if (!hv[nome]) hv[nome] = []
        const y = next[nome].status === 'occupied' ? 1 : next[nome].status === 'free' ? 0 : null
        if (y !== null) {
          hv[nome].push({ t, y })
          if (hv[nome].length > 500) hv[nome].shift()
        }

        const nomesNow = Object.keys(next)
        const livresNow = nomesNow.filter((n) => next[n].status === 'free').length
        setTotalSeries((s) => {
          const ns = [...s, { t, y: livresNow }]
          if (ns.length > 1000) ns.shift()
          return ns
        })
      } catch (e) {
        console.error(e)
      }

      return next
    })
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
            {connected ? 'Broker: conectado' : 'Broker: desconectado'}
          </div>
        </div>
      </header>

      <main>
        <section className="garage">
          <div className="grid">
            {nomes.length === 0 && <p className="placeholder">Aguardando mensagens MQTT (tópicos: vaga/&lt;nome&gt;/status, vaga/&lt;nome&gt;/distancia)</p>}
            {nomes.map((nome) => (
              <div key={nome} style={{display:'flex',flexDirection:'column',alignItems:'stretch',gap:6}}>
                <VagaCard nome={nome} data={vagas[nome]} />
                <div style={{marginTop:4}}>
                  <OccupancyChart data={(historyRef.current[nome] || []).slice(-120)} label={`Vaga ${nome}`} />
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
        <small>Broker: {BROKER}</small>
      </footer>
    </div>
  )
}
