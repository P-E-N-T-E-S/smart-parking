import React from 'react'
import Chart from 'react-apexcharts'

// TotalFreeChart: Gráfico de área mostrando vagas livres ao longo do tempo
// Props:
// - data: array of { t: timestamp(ms), y: number } representing total free at that time
export default function TotalFreeChart({ data = [] }) {
  const series = [{
    name: 'Vagas Livres',
    data: data.map(d => ({ x: d.t, y: d.y }))
  }]

  const options = {
    chart: {
      type: 'area',
      height: 280,
      fontFamily: "'Inter', -apple-system, sans-serif",
      toolbar: {
        show: true,
        tools: {
          download: true,
          selection: false,
          zoom: false,
          zoomin: true,
          zoomout: true,
          pan: false,
          reset: true
        }
      },
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
      },
      background: 'transparent'
    },
    dataLabels: {
      enabled: false
    },
    stroke: {
      curve: 'smooth',
      width: 3,
      colors: ['#6FFFA3']
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.6,
        opacityTo: 0.1,
        stops: [0, 90, 100]
      },
      colors: ['#6FFFA3']
    },
    markers: {
      size: 0,
      hover: {
        size: 6,
        sizeOffset: 3
      }
    },
    xaxis: {
      type: 'datetime',
      labels: {
        style: {
          colors: 'rgba(255,255,255,0.7)',
          fontSize: '12px'
        },
        datetimeUTC: false,
        datetimeFormatter: {
          year: 'yyyy',
          month: 'MMM yyyy',
          day: 'dd MMM',
          hour: 'HH:mm'
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
      min: 0,
      labels: {
        style: {
          colors: 'rgba(255,255,255,0.7)',
          fontSize: '12px'
        },
        formatter: function(value) {
          return Math.floor(value)
        }
      }
    },
    grid: {
      borderColor: 'rgba(255,255,255,0.1)',
      strokeDashArray: 4,
      xaxis: {
        lines: {
          show: true
        }
      },
      yaxis: {
        lines: {
          show: true
        }
      }
    },
    tooltip: {
      theme: 'dark',
      x: {
        format: 'dd/MM HH:mm:ss'
      },
      y: {
        formatter: function(value) {
          return value + ' vagas livres'
        }
      },
      style: {
        fontSize: '13px'
      }
    },
    legend: {
      show: false
    }
  }

  return (
    <div style={{width: '100%', height: 280}}>
      {data.length > 0 ? (
        <Chart 
          options={options} 
          series={series} 
          type="area" 
          height={280}
        />
      ) : (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'rgba(255,255,255,0.5)',
          fontSize: '14px'
        }}>
          Aguardando dados de histórico...
        </div>
      )}
    </div>
  )
}
