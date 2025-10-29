import React from 'react'

// VagaCard: representa visualmente uma vaga na garagem
// Props:
// - nome: identificador da vaga (ex: 'A1')
// - data: { status, distancia, lastUpdate }
// status esperado: 'free' | 'occupied' | 'unknown' (o App.jsx normaliza os valores)
export default function VagaCard({ nome, data = {} }) {
  const { status = 'unknown', distancia = null, lastUpdate = null } = data

  const isFree = status === 'free'
  const isOccupied = status === 'occupied'

  return (
    <div className={`spot ${isFree ? 'spot-free' : isOccupied ? 'spot-occupied' : 'spot-unknown'}`}>
      <div
        className="spot-rect"
        title={`${distancia ? `${distancia} cm` : '—'}${lastUpdate ? ' • ' + new Date(lastUpdate).toLocaleString() : ''}`}>
        <div className="spot-car" aria-hidden>{isOccupied ? '🚗' : ''}</div>
      </div>

      <div className="spot-meta">
        <div className="spot-name">Vaga {nome}</div>
        <div className="spot-info">
          <span className="spot-status">{status}</span>
          <span className="spot-dist">{distancia ? `${distancia} cm` : '—'}</span>
        </div>
        {lastUpdate && <div className="spot-time">{new Date(lastUpdate).toLocaleTimeString()}</div>}
      </div>
    </div>
  )
}
