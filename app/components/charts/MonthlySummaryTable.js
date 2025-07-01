'use client'

function formatMonthLabel(isoMonth) {
  const [year, month] = isoMonth.split('-')
  const date = new Date(`${year}-${month}-01`)
  return date.toLocaleString('default', { month: 'long', year: 'numeric' })
}

export default function MonthlySummaryTable({ data }) {
  return (
    <div className="bg-white p-4 rounded-lg shadow-lg overflow-x-auto">
      <h2 className="text-lg font-semibold mb-4">📅 Monthly Sales Summary</h2>
      <table className="w-full text-sm bg-white rounded overflow-hidden">
        <thead className="bg-indigo-600 text-white text-left">
          <tr>
            <th className="p-3 w-1/4">Month</th>
            <th className="p-3 w-1/4">Invoices</th>
            <th className="p-3 w-1/4">Revenue</th>
            <th className="p-3 w-1/4">Profit</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={row.month}
              className={`transition duration-200 cursor-pointer hover:bg-indigo-50 ${
                i % 2 === 0 ? 'bg-white' : 'bg-gray-50'
              }`}
            >
              <td className="p-3 font-medium">{formatMonthLabel(row.month)}</td>
              <td className="p-3">{row.invoices}</td>
              <td className="p-3 text-blue-700 font-semibold">Rs {Number(row.revenue).toLocaleString()}</td>
              <td className="p-3 text-green-700 font-semibold">Rs {Number(row.profit).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
