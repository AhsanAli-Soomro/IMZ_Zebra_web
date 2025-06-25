'use client'
import { Bar } from 'react-chartjs-2'

// Utility to convert "2025-06" → "Jun 2025"
const formatMonth = (raw) => {
  const [year, month] = raw.split('-')
  return new Date(year, month - 1).toLocaleString('default', { month: 'short', year: 'numeric' })
}

export default function MonthlyBarChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        No monthly data available
      </div>
    )
  }

  const chartData = {
    labels: data.map(d => formatMonth(d.month)),
    datasets: [
      {
        label: 'Revenue',
        data: data.map(d => d.revenue),
        backgroundColor: '#3b82f6',
        borderRadius: 4,
      },
      {
        label: 'Profit',
        data: data.map(d => d.profit),
        backgroundColor: '#10b981',
        borderRadius: 4,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#374151',
          font: { size: 12 },
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.dataset.label || ''
            const value = context.raw || 0
            return `${label}: Rs ${Number(value).toLocaleString()}`
          },
        },
      },
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: '#6b7280',
          callback: (val) => `Rs ${Number(val).toLocaleString()}`
        },
        grid: {
          color: '#e5e7eb',
          drawBorder: false,
        },
      },
      x: {
        ticks: {
          color: '#6b7280',
        },
        grid: {
          color: '#f3f4f6',
          drawBorder: false,
        },
      },
    },
  }

  return (
    <div className="w-full h-full">
      <Bar data={chartData} options={options} />
    </div>
  )
}
