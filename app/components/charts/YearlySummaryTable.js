'use client'

export default function YearlySummaryTable({ data }) {
  return (
    <div className="bg-white p-4 rounded-lg shadow-lg overflow-x-auto">
      <h2 className="text-lg font-semibold mb-4">📆 Yearly Sales Summary</h2>
      <table className="w-full text-sm bg-white rounded overflow-hidden">
        <thead className="bg-indigo-600 text-white">
          <tr>
            <th className="p-3 text-left">Year</th>
            <th className="p-3 text-left">Invoices</th>
            <th className="p-3 text-left">Revenue</th>
            <th className="p-3 text-left">Profit</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={row.year}
              className={`transition duration-200 cursor-pointer hover:bg-indigo-50 ${
                i % 2 === 0 ? 'bg-white' : 'bg-gray-50'
              }`}
            >
              <td className="p-3 font-medium">{row.year}</td>
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
