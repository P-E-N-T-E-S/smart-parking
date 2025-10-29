import React from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js'
import 'chartjs-adapter-date-fns'

ChartJS.register(TimeScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

// Props:
// - data: array of { t: timestamp(ms), y: 0|1 } representing occupied (1) or free (0)
// - label: string
export default function OccupancyChart({ data = [], label = 'ocupação' }) {
  const chartData = {
    datasets: [
      {
        label,
        data: data.map((d) => ({ x: d.t, y: d.y })),
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37,99,235,0.12)',
        tension: 0.3,
        fill: true,
        pointRadius: 0,
      },
    ],
  }

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: { mode: 'index', intersect: false },
    },
    scales: {
      x: { type: 'time', time: { unit: 'minute', tooltipFormat: 'HH:mm:ss' } },
      y: { min: 0, max: 1, ticks: { stepSize: 1 }, display: false },
    },
  }

  return <div style={{height:120}}><Line data={chartData} options={options} /></div>
}
