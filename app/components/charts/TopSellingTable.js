'use client'

export default function TopSellingTable({ data }) {
  if (!data || data.length === 0) {
    return <div className="text-gray-500 text-center py-8">No sales data found</div>
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow-lg overflow-x-auto">
      <h2 className="text-lg font-semibold mb-4">📋 Top Selling Products</h2>
      <table className="w-full text-sm bg-white rounded overflow-hidden">
        <thead className="bg-indigo-600 text-white text-left">
          <tr>
            <th className="p-3">#</th>
            <th className="p-3">Item Name</th>
            <th className="p-3">Qty Sold</th>
            <th className="p-3">Revenue</th>
            <th className="p-3">Profit</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, idx) => (
            <tr
              key={`${item.stock_id || idx}-${idx}`}
              className={`transition duration-200 cursor-pointer hover:bg-indigo-50 ${
                idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
              }`}
            >
              <td className="p-3">{idx + 1}</td>
              <td className="p-3 font-medium">{item.product_name}</td>
              <td className="p-3">{item.total_qty}</td>
              <td className="p-3 text-blue-700 font-semibold">
                Rs {Number(item.total_sales || 0).toLocaleString()}
              </td>
              <td className="p-3 text-green-700 font-semibold">
                Rs {Number(item.total_profit || 0).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}