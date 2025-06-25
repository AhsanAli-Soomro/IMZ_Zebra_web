import { Bubble } from 'react-chartjs-2'

export default function BubbleChart({ data }) {
  return (
    <div className="bg-white p-4 rounded shadow h-[350px]">
      <h2 className="font-semibold mb-2">Avg. Transaction Value by Month</h2>
      <Bubble
        options={{
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true },
            x: { type: 'category' }
          }
        }}
        data={{
          labels: data.map(d => d.month),
          datasets: [{
            label: 'Transaction Value',
            data: data.map(d => ({
              x: d.month,
              y: d.avg_value,
              r: d.radius || 15
            })),
            backgroundColor: '#6366f1'
          }]
        }}
      />
    </div>
  )
}
