import React from 'react'
import { Ruler } from 'lucide-react'
import VagaSparkline from './VagaSparkline'
import StatusTimer from './StatusTimer'

const CarTopDownIcon = ({ occupied = false }) => {
  const fillColor = occupied ? "#FFFFFF" : "#64748b"
  const strokeColor = occupied ? "rgba(255,255,255,0.8)" : "#475569"
  
  return (
    <svg className="car-icon-topdown" viewBox="0 0 120 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path 
        d="M30 20 L30 10 Q30 5 35 5 L85 5 Q90 5 90 10 L90 20 L95 40 L95 140 L90 160 L90 170 Q90 175 85 175 L35 175 Q30 175 30 170 L30 160 L25 140 L25 40 Z" 
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth="2"
      />
      
      <rect x="40" y="15" width="15" height="20" rx="2" fill={occupied ? "rgba(255,255,255,0.4)" : "#94a3b8"} />
      <rect x="65" y="15" width="15" height="20" rx="2" fill={occupied ? "rgba(255,255,255,0.4)" : "#94a3b8"} />
      
      <rect x="40" y="145" width="15" height="20" rx="2" fill={occupied ? "rgba(255,255,255,0.4)" : "#94a3b8"} />
      <rect x="65" y="145" width="15" height="20" rx="2" fill={occupied ? "rgba(255,255,255,0.4)" : "#94a3b8"} />
      
      <line x1="30" y1="70" x2="30" y2="110" stroke={strokeColor} strokeWidth="1.5" />
      <line x1="90" y1="70" x2="90" y2="110" stroke={strokeColor} strokeWidth="1.5" />
      
      <line x1="40" y1="45" x2="80" y2="45" stroke={strokeColor} strokeWidth="1" opacity="0.5" />
      
      <ellipse cx="20" cy="60" rx="6" ry="10" fill={fillColor} stroke={strokeColor} strokeWidth="1.5" />
      <ellipse cx="100" cy="60" rx="6" ry="10" fill={fillColor} stroke={strokeColor} strokeWidth="1.5" />
    </svg>
  )
}

export default function VagaCard({ nome, data = {}, sparklineData = [] }) {
  const { 
    status = 'unknown', 
    distancia = null, 
    lastUpdate = null, 
    esp32_controlled = false,
    statusChangeTime = null 
  } = data

  const isFree = status === 'free'
  const isOccupied = status === 'occupied'

  const statusText = isFree ? 'Livre' : isOccupied ? 'Ocupado' : 'Desconhecido'
  const statusClass = isFree ? 'free' : isOccupied ? 'occupied' : 'unknown'

  return (
    <div 
      className={`vaga-card status-${status}`}
      role="article"
      aria-label={`Vaga ${nome} - ${statusText}`}
    >
      <div className="vaga-visual">
        <CarTopDownIcon occupied={isOccupied} />
        {esp32_controlled && <div className="esp32-badge" aria-label="Controlado por ESP32">ESP32</div>}
      </div>

      <div className="vaga-info">
        <div className="vaga-name">Vaga {nome}</div>
        
        <div className={`vaga-status-badge ${statusClass}`}>
          {statusText}
        </div>

        {distancia && (
          <div className="vaga-details">
            <div className="vaga-detail-item">
              <Ruler size={14} strokeWidth={2} style={{marginRight:4}} />
              <span>{distancia} cm</span>
            </div>
          </div>
        )}

        <StatusTimer statusChangeTime={statusChangeTime} status={status} />

      </div>
    </div>
  )
}
