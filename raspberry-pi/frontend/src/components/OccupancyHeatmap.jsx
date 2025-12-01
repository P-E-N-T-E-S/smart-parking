import React, { useMemo } from 'react'
import Chart from 'react-apexcharts'

// OccupancyHeatmap: Heatmap mostrando ocupação média por hora do dia e dia da semana
// Props:
// - historyRef: referência ao histórico de todas as vagas { vagaName: [{t, y}] }
export default function OccupancyHeatmap({ historyRef }) {
  const heatmapData = useMemo(() => {
    // Inicializa matriz 7 dias x 24 horas
    const matrix = Array(7).fill(null).map(() => Array(24).fill({ sum: 0, count: 0 }))
    
    if (!historyRef || !historyRef.current) return []

    // Processa todo o histórico
    Object.values(historyRef.current).forEach(vagaHistory => {
      if (!Array.isArray(vagaHistory)) return
      
      vagaHistory.forEach(point => {
        const date = new Date(point.t)
        const dayOfWeek = date.getDay() // 0 = domingo, 6 = sábado
        const hour = date.getHours() // 0-23
        
        if (point.y !== null && point.y !== undefined) {
          const current = matrix[dayOfWeek][hour]
          matrix[dayOfWeek][hour] = {
            sum: current.sum + point.y,
            count: current.count + 1
          }
        }
      })
    })

    // Calcula médias e formata para ApexCharts
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    
    return dayNames.map((dayName, dayIndex) => ({
      name: dayName,
      data: Array(24).fill(0).map((_, hour) => {
        const cell = matrix[dayIndex][hour]
        const avgOccupancy = cell.count > 0 ? (cell.sum / cell.count) * 100 : 0
        return {
          x: `${hour}h`,
          y: Math.round(avgOccupancy)
        }
      })
    }))
  }, [historyRef])

  const options = {
    chart: {
      type: 'heatmap',
      height: 350,
      fontFamily: "'Inter', -apple-system, sans-serif",
      toolbar: {
        show: true,
        tools: {
          download: true,
          selection: false,
          zoom: false,
          zoomin: false,
          zoomout: false,
          pan: false,
          reset: false
        }
      },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 600
      }
    },
    plotOptions: {
      heatmap: {
        shadeIntensity: 0.5,
        radius: 4,
        useFillColorAsStroke: false,
        colorScale: {
          ranges: [
            { from: 0, to: 20, color: '#6FFFA3', name: 'Muito Livre' },
            { from: 21, to: 40, color: '#4ADE80', name: 'Livre' },
            { from: 41, to: 60, color: '#FACC15', name: 'Moderado' },
            { from: 61, to: 80, color: '#FB923C', name: 'Ocupado' },
            { from: 81, to: 100, color: '#EF4444', name: 'Muito Ocupado' }
          ]
        }
      }
    },
    dataLabels: {
      enabled: false
    },
    stroke: {
      width: 1,
      colors: ['rgba(255,255,255,0.1)']
    },
    title: {
      text: undefined
    },
    xaxis: {
      type: 'category',
      categories: Array(24).fill(0).map((_, i) => `${i}h`),
      labels: {
        style: {
          colors: 'rgba(255,255,255,0.7)',
          fontSize: '11px'
        }
      },
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      }
    },
    yaxis: {
      labels: {
        style: {
          colors: 'rgba(255,255,255,0.7)',
          fontSize: '12px',
          fontWeight: 500
        }
      }
    },
    grid: {
      show: false
    },
    tooltip: {
      theme: 'dark',
      y: {
        formatter: function(value) {
          return value + '% ocupado'
        }
      },
      style: {
        fontSize: '13px'
      }
    },
    legend: {
      show: true,
      position: 'bottom',
      horizontalAlign: 'center',
      fontSize: '12px',
      labels: {
        colors: 'rgba(255,255,255,0.8)'
      },
      markers: {
        width: 20,
        height: 8,
        radius: 2
      }
    }
  }

  return (
    <div className="heatmap-container" style={{
      background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)',
      borderRadius: '16px',
      padding: '24px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.1)'
    }}>
      <div style={{
        fontSize: '18px',
        fontWeight: 600,
        color: '#FFFFFF',
        marginBottom: '16px'
      }}>
        Ocupação por Hora do Dia
      </div>
      <div style={{
        fontSize: '13px',
        color: 'rgba(255,255,255,0.6)',
        marginBottom: '20px'
      }}>
        Média de ocupação (%) ao longo da semana
      </div>
      {heatmapData.length > 0 ? (
        <Chart 
          options={options} 
          series={heatmapData} 
          type="heatmap" 
          height={350}
        />
      ) : (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          color: 'rgba(255,255,255,0.5)',
          fontSize: '14px'
        }}>
          Coletando dados... O heatmap será exibido após acumular histórico suficiente.
        </div>
      )}
    </div>
  )
}
