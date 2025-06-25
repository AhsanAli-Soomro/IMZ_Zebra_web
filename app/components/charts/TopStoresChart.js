'use client'
import { Bar } from 'react-chartjs-2'

export default function TopStoresChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[350px] text-gray-400">
        No store sales data available
      </div>
    )
  }

  const labels = data.map(d => d.name)
  const values = data.map(d => d.sales)

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Total Sales',
        data: values,
        backgroundColor: '#f59e0b',
        borderRadius: 6,
        barThickness: 20,
      },
    ],
  }

  const options = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ctx => `₹${Number(ctx.raw).toLocaleString()}`
        }
      }
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: {
          callback: val => `₹${val}`,
          color: '#6b7280'
        },
        grid: { color: '#e5e7eb' }
      },
      y: {
        ticks: { color: '#374151' },
        grid: { display: false }
      }
    }
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow-md w-full h-[350px]">
      <h2 className="font-semibold text-gray-700 mb-3">🏬 Top 5 Stores by Sales</h2>
      <Bar data={chartData} options={options} />
    </div>
  )
}
