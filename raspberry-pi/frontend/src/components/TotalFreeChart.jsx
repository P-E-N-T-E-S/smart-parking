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
// - data: array of { t: timestamp(ms), y: number } representing total free at that time
export default function TotalFreeChart({ data = [] }) {
  const chartData = {
    datasets: [
      {
        label: 'Vagas livres',
        data: data.map((d) => ({ x: d.t, y: d.y })),
        borderColor: '#16a34a',
        backgroundColor: 'rgba(16,163,74,0.12)',
        tension: 0.2,
        fill: true,
        pointRadius: 2,
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
      y: { beginAtZero: true },
    },
  }

  return <div style={{height:160}}><Line data={chartData} options={options} /></div>
}
