import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

// KPICard: Card de indicador chave de performance
// Props:
// - title: título do KPI
// - value: valor principal (número ou string)
// - subtitle: texto secundário opcional
// - trend: 'up' | 'down' | 'neutral' (opcional)
// - trendValue: valor da tendência (ex: "+5%" ou "-3%")
// - icon: componente de ícone do Lucide React
// - color: cor do tema (ex: '#1E88E5', '#6FFFA3')
export default function KPICard({ 
  title, 
  value, 
  subtitle, 
  trend, 
  trendValue, 
  icon: Icon,
  color = '#1E88E5'
}) {
  const getTrendIcon = () => {
    switch(trend) {
      case 'up': return <TrendingUp size={16} strokeWidth={2.5} />
      case 'down': return <TrendingDown size={16} strokeWidth={2.5} />
      default: return <Minus size={16} strokeWidth={2.5} />
    }
  }

  const getTrendColor = () => {
    switch(trend) {
      case 'up': return '#6FFFA3'
      case 'down': return '#f87171'
      default: return 'rgba(255,255,255,0.5)'
    }
  }

  return (
    <div className="kpi-card" style={{
      background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      transition: 'all 0.3s ease',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Gradiente de fundo decorativo */}
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '120px',
        height: '120px',
        background: `radial-gradient(circle, ${color}33 0%, transparent 70%)`,
        pointerEvents: 'none'
      }} />

      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: '16px',
        position: 'relative'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {Icon && (
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: `${color}22`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: color
            }}>
              <Icon size={22} strokeWidth={2.5} />
            </div>
          )}
          <div>
            <div style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'rgba(255,255,255,0.7)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              {title}
            </div>
          </div>
        </div>
        
        {trend && trendValue && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            borderRadius: '6px',
            background: `${getTrendColor()}22`,
            color: getTrendColor(),
            fontSize: '12px',
            fontWeight: 600
          }}>
            {getTrendIcon()}
            {trendValue}
          </div>
        )}
      </div>

      <div style={{
        fontSize: '36px',
        fontWeight: 700,
        color: '#FFFFFF',
        marginBottom: subtitle ? '4px' : '0',
        lineHeight: 1
      }}>
        {value}
      </div>

      {subtitle && (
        <div style={{
          fontSize: '13px',
          color: 'rgba(255,255,255,0.6)',
          marginTop: '4px'
        }}>
          {subtitle}
        </div>
      )}
    </div>
  )
}
