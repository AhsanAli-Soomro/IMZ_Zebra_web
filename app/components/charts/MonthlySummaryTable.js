'use client'

function formatMonthLabel(isoMonth) {
  const [year, month] = isoMonth.split('-')
  const date = new Date(`${year}-${month}-01`)
  return date.toLocaleString('default', { month: 'long', year: 'numeric' })
}

export default function MonthlySummaryTable({ data }) {
  return (
    <div className="bg-white p-4 rounded shadow overflow-x-auto">
      <h2 className="font-semibold mb-2">📅 Monthly Sales Summary</h2>
      <table className="w-full text-left text-sm table-fixed">
        <thead className="bg-gray-100 text-xs uppercase">
          <tr>
            <th className="p-3 w-1/4">Month</th>
            <th className="p-3 w-1/4">Invoices</th>
            <th className="p-3 w-1/4">Revenue</th>
            <th className="p-3 w-1/4">Profit</th>
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr key={row.month} className="border-t hover:bg-gray-50">
              <td className="p-3">{formatMonthLabel(row.month)}</td>
              <td className="p-3">{row.invoices}</td>
              <td className="p-3">Rs {Number(row.revenue).toLocaleString()}</td>
              <td className="p-3 text-green-600 font-medium">
                Rs {Number(row.profit).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
