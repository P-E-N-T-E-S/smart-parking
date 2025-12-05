import React from 'react'
import Chart from 'react-apexcharts'

// FreeSpotGauge: Gauge semicircular mostrando % de vagas livres
// Props:
// - livres: número de vagas livres
// - total: total de vagas
export default function FreeSpotGauge({ livres = 0, total = 1 }) {
  const percentage = total > 0 ? Math.round((livres / total) * 100) : 0

  const options = {
    chart: {
      type: 'radialBar',
      height: 280,
      fontFamily: "'Inter', -apple-system, sans-serif",
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800,
        animateGradually: {
          enabled: true,
          delay: 150
        },
        dynamicAnimation: {
          enabled: true,
          speed: 350
        }
      }
    },
    plotOptions: {
      radialBar: {
        startAngle: -135,
        endAngle: 135,
        hollow: {
          margin: 0,
          size: '70%',
          background: 'transparent',
          position: 'front',
        },
        track: {
          background: 'rgba(255,255,255,0.15)',
          strokeWidth: '100%',
          margin: 0,
          dropShadow: {
            enabled: false
          }
        },
        dataLabels: {
          show: true,
          name: {
            offsetY: -10,
            show: true,
            color: 'var(--text-primary, #FFFFFF)',
            fontSize: '14px',
            fontWeight: 500
          },
          value: {
            formatter: function(val) {
              return parseInt(val) + '%'
            },
            color: 'var(--text-primary, #FFFFFF)',
            fontSize: '42px',
            fontWeight: 700,
            show: true,
            offsetY: 6
          }
        }
      }
    },
    fill: {
      type: 'gradient',
      gradient: {
        shade: 'dark',
        type: 'horizontal',
        shadeIntensity: 0.5,
        gradientToColors: ['#6FFFA3'],
        inverseColors: false,
        opacityFrom: 1,
        opacityTo: 1,
        stops: [0, 100]
      }
    },
    colors: ['#1E88E5'],
    stroke: {
      lineCap: 'round'
    },
    labels: ['Vagas Livres']
  }

  const series = [percentage]

  return (
    <div className="gauge-container" style={{
      background: 'linear-gradient(135deg, rgba(30, 136, 229, 0.15) 0%, rgba(111, 255, 163, 0.1) 100%)',
      borderRadius: '16px',
      padding: '24px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.1)'
    }}>
      <div style={{
        fontSize: '18px',
        fontWeight: 600,
        color: 'var(--text-primary, #FFFFFF)',
        marginBottom: '8px',
        textAlign: 'center'
      }}>
        Disponibilidade em Tempo Real
      </div>
      <Chart 
        options={options} 
        series={series} 
        type="radialBar" 
        height={280}
      />
      <div style={{
        display: 'flex',
        justifyContent: 'space-around',
        marginTop: '16px',
        paddingTop: '16px',
        borderTop: '1px solid rgba(255, 255, 255, 0.15)'
      }}>
        <div style={{textAlign: 'center'}}>
          <div style={{
            fontSize: '28px',
            fontWeight: 700,
            color: '#6FFFA3'
          }}>
            {livres}
          </div>
          <div style={{
            fontSize: '12px',
            color: 'var(--text-secondary, rgba(255,255,255,0.7))',
            marginTop: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Livres
          </div>
        </div>
        <div style={{textAlign: 'center'}}>
          <div style={{
            fontSize: '28px',
            fontWeight: 700,
            color: '#1E88E5'
          }}>
            {total - livres}
          </div>
          <div style={{
            fontSize: '12px',
            color: 'var(--text-secondary, rgba(255,255,255,0.7))',
            marginTop: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Ocupadas
          </div>
        </div>
        <div style={{textAlign: 'center'}}>
          <div style={{
            fontSize: '28px',
            fontWeight: 700,
            color: 'var(--text-primary, #FFFFFF)'
          }}>
            {total}
          </div>
          <div style={{
            fontSize: '12px',
            color: 'var(--text-secondary, rgba(255,255,255,0.7))',
            marginTop: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Total
          </div>
        </div>
      </div>
    </div>
  )
}
