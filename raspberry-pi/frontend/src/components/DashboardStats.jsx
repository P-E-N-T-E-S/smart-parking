import React from 'react'
import { ParkingSquare, CheckCircle2, XCircle, Clock } from 'lucide-react'

export default function DashboardStats({ vagas }) {
  const nomes = Object.keys(vagas)
  const total = nomes.length
  const livres = nomes.filter(n => vagas[n]?.status === 'free').length
  const ocupadas = total - livres
  const percentLivre = total > 0 ? Math.round((livres / total) * 100) : 0

  const lastUpdate = Math.max(...nomes.map(n => vagas[n]?.lastUpdate || 0))
  const lastUpdateText = lastUpdate > 0 ? new Date(lastUpdate).toLocaleTimeString() : '—'

  return (
    <div className="dashboard-stats">
      <div className="stat-card stat-total">
        <div className="stat-icon">
          <ParkingSquare size={28} strokeWidth={2.5} />
        </div>
        <div className="stat-content">
          <div className="stat-value">{total}</div>
          <div className="stat-label">Total de Vagas</div>
        </div>
      </div>

      <div className="stat-card stat-free">
        <div className="stat-icon">
          <CheckCircle2 size={28} strokeWidth={2.5} />
        </div>
        <div className="stat-content">
          <div className="stat-value">{livres}</div>
          <div className="stat-label">Vagas Livres</div>
          <div className="stat-percent">{percentLivre}%</div>
        </div>
      </div>

      <div className="stat-card stat-occupied">
        <div className="stat-icon">
          <XCircle size={28} strokeWidth={2.5} />
        </div>
        <div className="stat-content">
          <div className="stat-value">{ocupadas}</div>
          <div className="stat-label">Vagas Ocupadas</div>
        </div>
      </div>

      <div className="stat-card stat-update">
        <div className="stat-icon">
          <Clock size={28} strokeWidth={2.5} />
        </div>
        <div className="stat-content">
          <div className="stat-value">{lastUpdateText}</div>
          <div className="stat-label">Última Atualização</div>
        </div>
      </div>
    </div>
  )
}
