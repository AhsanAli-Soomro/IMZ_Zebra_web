'use client'
import { Bar } from 'react-chartjs-2'

export default function YearlyBarChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        No yearly data available
      </div>
    )
  }

  const chartData = {
    labels: data.map((d) => d.year),
    datasets: [
      {
        label: 'Revenue',
        data: data.map((d) => d.revenue),
        backgroundColor: '#3b82f6',
      },
      {
        label: 'Profit',
        data: data.map((d) => d.profit),
        backgroundColor: '#10b981',
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false, // ✅ ensures full height fill
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
          label: (ctx) => `${ctx.dataset.label}: Rs ${Number(ctx.parsed.y).toLocaleString()}`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { color: '#6b7280' },
        grid: { color: '#e5e7eb' },
      },
      x: {
        ticks: { color: '#6b7280' },
        grid: { color: '#f3f4f6' },
      },
    },
  }

  return (
    <div className="w-full h-full">
      <Bar data={chartData} options={options} />
    </div>
  )
}
