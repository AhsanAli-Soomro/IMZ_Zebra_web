'use client'
import { Bar } from 'react-chartjs-2'

export default function TopSellingBarChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        No sales data found
      </div>
    )
  }

  const chartData = {
    labels: data.map((p) => p.product_name),
    datasets: [
      {
        label: 'Qty Sold',
        data: data.map((p) => Number(p.total_qty || 0)),
        backgroundColor: '#3b82f6',
        borderRadius: 6,
        barPercentage: 0.6,
        categoryPercentage: 0.6,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `Sold: ${Number(ctx.raw || 0).toLocaleString()} pcs`,
        },
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { color: '#6b7280' },
        grid: { color: '#e5e7eb' },
      },
      x: {
        ticks: {
          color: '#6b7280',
          autoSkip: false,
          maxRotation: 30,
          minRotation: 0,
        },
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