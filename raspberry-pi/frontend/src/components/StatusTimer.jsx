import React, { useState, useEffect } from 'react'

export default function StatusTimer({ lastUpdate, status }) {
  const [timeElapsed, setTimeElapsed] = useState('')

  useEffect(() => {
    if (!lastUpdate) return

    const updateTimer = () => {
      const now = Date.now()
      const diff = now - lastUpdate
      
      const seconds = Math.floor(diff / 1000)
      const minutes = Math.floor(seconds / 60)
      const hours = Math.floor(minutes / 60)
      const days = Math.floor(hours / 24)

      let timeString = ''
      if (days > 0) {
        timeString = `${days}d ${hours % 24}h`
      } else if (hours > 0) {
        timeString = `${hours}h ${minutes % 60}m`
      } else if (minutes > 0) {
        timeString = `${minutes}m ${seconds % 60}s`
      } else {
        timeString = `${seconds}s`
      }

      setTimeElapsed(timeString)
    }

    // Atualiza imediatamente
    updateTimer()
    
    // Atualiza a cada segundo
    const interval = setInterval(updateTimer, 1000)
    
    return () => clearInterval(interval)
  }, [lastUpdate])

  if (!lastUpdate || !status) {
    return (
      <div style={{
        fontSize: 11,
        color: '#6c757d',
        padding: '4px 8px',
        backgroundColor: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: 4,
        textAlign: 'center'
      }}>
        Status desconhecido
      </div>
    )
  }

  const statusText = status === 'occupied' ? 'ocupada' : status === 'free' ? 'livre' : status
  const bgColor = status === 'occupied' ? '#fff3cd' : status === 'free' ? '#d1edff' : '#f8f9fa'
  const borderColor = status === 'occupied' ? '#ffeaa7' : status === 'free' ? '#9ecaed' : '#dee2e6'
  const textColor = status === 'occupied' ? '#856404' : status === 'free' ? '#055160' : '#6c757d'

  return (
    <div style={{
      fontSize: 11,
      color: textColor,
      padding: '4px 8px',
      backgroundColor: bgColor,
      border: `1px solid ${borderColor}`,
      borderRadius: 4,
      textAlign: 'center',
      fontWeight: '500'
    }}>
      {statusText} há {timeElapsed}
    </div>
  )
}