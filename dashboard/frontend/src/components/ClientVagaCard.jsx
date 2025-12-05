import React from 'react'

export default function ClientVagaCard({ nome, data = {}, onOcupar }) {
  const { status = 'unknown', distancia = null } = data

  const isFree = status === 'free'

  const CarTopDownIcon = () => {
    return (
      <svg className="car-icon-client" viewBox="0 0 120 180" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path 
          d="M30 20 L30 10 Q30 5 35 5 L85 5 Q90 5 90 10 L90 20 L95 40 L95 140 L90 160 L90 170 Q90 175 85 175 L35 175 Q30 175 30 170 L30 160 L25 140 L25 40 Z" 
          fill="#64748b"
          stroke="#475569"
          strokeWidth="2"
        />
        
        <rect x="40" y="15" width="15" height="20" rx="2" fill="#94a3b8" />
        <rect x="65" y="15" width="15" height="20" rx="2" fill="#94a3b8" />
        
        <rect x="40" y="145" width="15" height="20" rx="2" fill="#94a3b8" />
        <rect x="65" y="145" width="15" height="20" rx="2" fill="#94a3b8" />
        
        <line x1="30" y1="70" x2="30" y2="110" stroke="#475569" strokeWidth="1.5" />
        <line x1="90" y1="70" x2="90" y2="110" stroke="#475569" strokeWidth="1.5" />
        
        <line x1="40" y1="45" x2="80" y2="45" stroke="#475569" strokeWidth="1" opacity="0.5" />
        
        <ellipse cx="20" cy="60" rx="6" ry="10" fill="#64748b" stroke="#475569" strokeWidth="1.5" />
        <ellipse cx="100" cy="60" rx="6" ry="10" fill="#64748b" stroke="#475569" strokeWidth="1.5" />
      </svg>
    )
  }

  if (!isFree) return null

  return (
    <div className="client-vaga-card">
      <div className="vaga-visual">
        <CarTopDownIcon />
      </div>

      <div className="vaga-info">
        <div className="vaga-name">Vaga {nome}</div>
        
        <div className="vaga-status-badge free">
          Disponível
        </div>

        {distancia && (
          <div className="vaga-distance">
            Sensor: {distancia} cm
          </div>
        )}

        <button 
          className="ocupar-button"
          onClick={onOcupar}
        >
          Reservar Esta Vaga
        </button>
      </div>
    </div>
  )
}