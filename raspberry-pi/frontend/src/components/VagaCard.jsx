import React from 'react'
import { Ruler, CheckCircle, Car as CarIcon } from 'lucide-react'
import VagaSparkline from './VagaSparkline'

// Ícone SVG de carro visto de cima (top-down view) - minimalista e clean
const CarTopDownIcon = ({ occupied = false }) => {
  const fillColor = occupied ? "#FFFFFF" : "#64748b"
  const strokeColor = occupied ? "rgba(255,255,255,0.8)" : "#475569"
  
  return (
    <svg className="car-icon-topdown" viewBox="0 0 120 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Corpo principal do carro */}
      <path 
        d="M30 20 L30 10 Q30 5 35 5 L85 5 Q90 5 90 10 L90 20 L95 40 L95 140 L90 160 L90 170 Q90 175 85 175 L35 175 Q30 175 30 170 L30 160 L25 140 L25 40 Z" 
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth="2"
      />
      
      {/* Janelas dianteiras */}
      <rect x="40" y="15" width="15" height="20" rx="2" fill={occupied ? "rgba(255,255,255,0.4)" : "#94a3b8"} />
      <rect x="65" y="15" width="15" height="20" rx="2" fill={occupied ? "rgba(255,255,255,0.4)" : "#94a3b8"} />
      
      {/* Janelas traseiras */}
      <rect x="40" y="145" width="15" height="20" rx="2" fill={occupied ? "rgba(255,255,255,0.4)" : "#94a3b8"} />
      <rect x="65" y="145" width="15" height="20" rx="2" fill={occupied ? "rgba(255,255,255,0.4)" : "#94a3b8"} />
      
      {/* Portas (linhas laterais) */}
      <line x1="30" y1="70" x2="30" y2="110" stroke={strokeColor} strokeWidth="1.5" />
      <line x1="90" y1="70" x2="90" y2="110" stroke={strokeColor} strokeWidth="1.5" />
      
      {/* Detalhes do capô */}
      <line x1="40" y1="45" x2="80" y2="45" stroke={strokeColor} strokeWidth="1" opacity="0.5" />
      
      {/* Retrovisores */}
      <ellipse cx="20" cy="60" rx="6" ry="10" fill={fillColor} stroke={strokeColor} strokeWidth="1.5" />
      <ellipse cx="100" cy="60" rx="6" ry="10" fill={fillColor} stroke={strokeColor} strokeWidth="1.5" />
    </svg>
  )
}

// VagaCard: representa visualmente uma vaga na garagem
// Props:
// - nome: identificador da vaga (ex: 'A1')
// - data: { status, distancia, lastUpdate, esp32_controlled, statusChangeTime }
// - onToggle: função para alternar status da vaga (opcional)
// - sparklineData: array de {t, y} para histórico (opcional)
// status esperado: 'free' | 'occupied' | 'unknown' (o App.jsx normaliza os valores)
export default function VagaCard({ nome, data = {}, onToggle, sparklineData = [] }) {
  const { 
    status = 'unknown', 
    distancia = null, 
    lastUpdate = null, 
    esp32_controlled = false,
    statusChangeTime = null 
  } = data

  const isFree = status === 'free'
  const isOccupied = status === 'occupied'

  const handleToggle = () => {
    if (onToggle && !esp32_controlled) {
      onToggle()
    }
  }

  const statusText = isFree ? 'Livre' : isOccupied ? 'Ocupado' : 'Desconhecido'
  const statusClass = isFree ? 'free' : isOccupied ? 'occupied' : 'unknown'
  
  // Calcula tempo desde a última mudança de status
  const getTimeElapsed = () => {
    if (!statusChangeTime) return ''
    const diff = Date.now() - statusChangeTime
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) return `há ${hours}h ${minutes % 60}m`
    if (minutes > 0) return `há ${minutes}m`
    return `há ${seconds}s`
  }

  return (
    <div 
      className={`vaga-card status-${status}`}
      role="article"
      aria-label={`Vaga ${nome} - ${statusText}`}
    >
      <div className="vaga-visual" onClick={esp32_controlled ? null : handleToggle}>
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

        {statusChangeTime && (
          <div className="vaga-timer">
            {statusText} {getTimeElapsed()}
          </div>
        )}

        {!esp32_controlled && onToggle && (
          <button 
            className={`vaga-action ${isFree ? 'action-occupy' : 'action-free'}`}
            onClick={handleToggle}
            aria-label={isFree ? `Ocupar vaga ${nome}` : `Liberar vaga ${nome}`}
          >
            {isFree ? (
              <><CarIcon size={16} strokeWidth={2.5} style={{marginRight:6, display:'inline-block', verticalAlign:'middle'}} aria-hidden="true" />Ocupar Vaga</>
            ) : (
              <><CheckCircle size={16} strokeWidth={2.5} style={{marginRight:6, display:'inline-block', verticalAlign:'middle'}} aria-hidden="true" />Liberar Vaga</>
            )}
          </button>
        )}

        {sparklineData.length > 1 && (
          <VagaSparkline data={sparklineData} status={status} />
        )}
      </div>
    </div>
  )
}
