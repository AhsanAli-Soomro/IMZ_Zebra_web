'use client'
import { Doughnut } from 'react-chartjs-2'

export default function YearlyDoughnutChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        No yearly data available
      </div>
    )
  }

  // 🎨 Generate consistent pastel color palette
  const generateColors = (count) =>
    Array.from({ length: count }, (_, i) => `hsl(${(i * 360) / count}, 70%, 75%)`)

  const chartData = {
    labels: data.map((d) => d.year),
    datasets: [
      {
        label: 'Yearly Revenue',
        data: data.map((d) => d.revenue),
        backgroundColor: generateColors(data.length),
        borderWidth: 1,
        hoverOffset: 8,
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
          boxWidth: 12,
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const value = Number(ctx.parsed).toLocaleString()
            return `${ctx.label}: Rs ${value}`
          },
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
