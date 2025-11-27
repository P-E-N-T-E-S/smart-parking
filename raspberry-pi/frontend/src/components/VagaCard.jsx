import React from 'react'

// VagaCard: representa visualmente uma vaga na garagem
// Props:
// - nome: identificador da vaga (ex: 'A1')
// - data: { status, distancia, lastUpdate, esp32_controlled }
// - onToggle: função para alternar status da vaga (opcional)
// status esperado: 'free' | 'occupied' | 'unknown' (o App.jsx normaliza os valores)
export default function VagaCard({ nome, data = {}, onToggle }) {
  const { status = 'unknown', distancia = null, lastUpdate = null, esp32_controlled = false } = data

  const isFree = status === 'free'
  const isOccupied = status === 'occupied'

  const handleToggle = () => {
    if (onToggle && !esp32_controlled) {
      onToggle()
    }
  }

  return (
    <div className={`spot ${isFree ? 'spot-free' : isOccupied ? 'spot-occupied' : 'spot-unknown'}`}>
      <div
        className="spot-rect"
        title={`${distancia ? `${distancia} cm` : '—'}${lastUpdate ? ' • ' + new Date(lastUpdate).toLocaleString() : ''}`}
        onClick={handleToggle}
        style={{ cursor: esp32_controlled ? 'default' : 'pointer' }}>
        <div className="spot-car" aria-hidden>{isOccupied ? '🚗' : ''}</div>
        {esp32_controlled && <div className="spot-badge">ESP32</div>}
      </div>

      <div className="spot-meta">
        <div className="spot-name">Vaga {nome}</div>
        <div className="spot-info">
          <span className="spot-status">{status}</span>
          <span className="spot-dist">{distancia ? `${distancia} cm` : '—'}</span>
        </div>
        {lastUpdate && <div className="spot-time">{new Date(lastUpdate).toLocaleTimeString()}</div>}
        {!esp32_controlled && onToggle && (
          <button className="spot-toggle" onClick={handleToggle}>
            {isFree ? 'Ocupar' : 'Liberar'}
          </button>
        )}
      </div>
    </div>
  )
}
