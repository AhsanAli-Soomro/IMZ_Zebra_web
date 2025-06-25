'use client'
import { Doughnut } from 'react-chartjs-2'

// Helper to format "YYYY-MM" → "Jun 2025"
const formatMonth = (raw) => {
  const [year, month] = raw.split('-')
  return new Date(year, month - 1).toLocaleString('default', { month: 'short', year: 'numeric' })
}

export default function MonthlyDoughnutChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        No monthly revenue data available
      </div>
    )
  }

  // Generate consistent pastel color palette
  const generateColors = (count) =>
    Array.from({ length: count }, (_, i) => `hsl(${(i * 360) / count}, 70%, 75%)`)

  const chartData = {
    labels: data.map(d => formatMonth(d.month)),
    datasets: [
      {
        label: 'Monthly Revenue',
        data: data.map(d => d.revenue),
        backgroundColor: generateColors(data.length),
        borderWidth: 1,
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
          label: (ctx) =>
            `${ctx.label}: Rs ${Number(ctx.parsed).toLocaleString()}`,
        },
      },
    },
  }

  return (
    <div className="w-full h-full">
      <Doughnut data={chartData} options={options} />
    </div>
  )
}
