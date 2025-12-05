import React from 'react'
import Chart from 'react-apexcharts'

// VagaSparkline: Mini chart mostrando tendência de ocupação da vaga
// Props:
// - data: array de {t, y} onde y=1 ocupado, y=0 livre
// - status: 'free' | 'occupied' | 'unknown'
export default function VagaSparkline({ data = [], status = 'unknown' }) {
  // Pega últimos 50 pontos
  const sparkData = data.slice(-50).map(point => ({
    x: point.t,
    y: point.y
  }))

  const color = status === 'occupied' ? '#1E88E5' : status === 'free' ? '#6FFFA3' : '#94a3b8'

  const options = {
    chart: {
      type: 'area',
      height: 60,
      sparkline: {
        enabled: true
      },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 400
      }
    },
    stroke: {
      curve: 'smooth',
      width: 2,
      colors: [color]
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.45,
        opacityTo: 0.05,
        stops: [0, 100]
      },
      colors: [color]
    },
    markers: {
      size: 0
    },
    tooltip: {
      enabled: false
    },
    xaxis: {
      type: 'datetime'
    },
    yaxis: {
      min: 0,
      max: 1
    }
  }

  const series = [{
    name: 'Status',
    data: sparkData.length > 0 ? sparkData : [{ x: Date.now(), y: 0 }]
  }]

  return (
    <div className="vaga-sparkline" style={{
      width: '100%',
      height: '60px',
      marginTop: '8px',
      borderRadius: '6px',
      overflow: 'hidden',
      background: 'rgba(0,0,0,0.15)'
    }}>
      {sparkData.length > 1 ? (
        <Chart 
          options={options} 
          series={series} 
          type="area" 
          height={60}
        />
      ) : (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          fontSize: '11px',
          color: 'rgba(255,255,255,0.4)'
        }}>
          Aguardando dados...
        </div>
      )}
    </div>
  )
}
