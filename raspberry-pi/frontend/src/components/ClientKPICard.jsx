import React from 'react'

export default function ClientKPICard({ title, value, subtitle, icon: Icon, color = '#1E88E5' }) {
  return (
    <div className="client-kpi-card">
      <div className="kpi-icon" style={{ backgroundColor: color }}>
        <Icon size={24} color="white" strokeWidth={2.5} />
      </div>
      
      <div className="kpi-content">
        <div className="kpi-title">{title}</div>
        <div className="kpi-value" style={{ color: color }}>
          {value}
        </div>
        {subtitle && (
          <div className="kpi-subtitle">{subtitle}</div>
        )}
      </div>
    </div>
  )
}