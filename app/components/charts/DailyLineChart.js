'use client'
import { Line } from 'react-chartjs-2'

export default function DailyLineChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Not enough data to show chart
      </div>
    )
  }

  const chartData = {
    labels: data.map(d => d.date),
    datasets: [
      {
        label: 'Revenue',
        data: data.map(d => d.revenue),
        borderColor: '#3b82f6',        // Tailwind blue-500
        backgroundColor: '#93c5fd80',  // Light blue fill
        tension: 0.4,
        fill: true,
        pointRadius: 3,
        pointHoverRadius: 5,
      },
      {
        label: 'Profit',
        data: data.map(d => d.profit),
        borderColor: '#10b981',        // Tailwind green-500
        backgroundColor: '#6ee7b780',  // Light green fill
        tension: 0.4,
        fill: true,
        pointRadius: 3,
        pointHoverRadius: 5,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { boxWidth: 12, padding: 15 },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: '#111827', // dark background for tooltip
        titleColor: '#fff',
        bodyColor: '#d1d5db',
        borderColor: '#3b82f6',
        borderWidth: 1,
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
          callback: val => `Rs ${Number(val).toLocaleString()}`,
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
      <Line data={chartData} options={options} />
    </div>
  )
}
