'use client'

export default function TopSellingTable({ data }) {
  if (!data || data.length === 0) {
    return <div className="text-gray-500 text-center py-8">No sales data found</div>
  }

  return (
    <div className="bg-white p-4 rounded shadow overflow-x-auto">
      <h2 className="font-semibold text-base mb-3">📋 Top Selling Products (Table)</h2>
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-100 text-xs uppercase">
          <tr>
            <th className="p-2">#</th>
            <th className="p-2">Item Name</th>
            <th className="p-2">Qty Sold</th>
            <th className="p-2">Revenue</th>
            <th className="p-2">Profit</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, idx) => (
            <tr key={item.id} className="border-t hover:bg-gray-50">
              <td className="p-2">{idx + 1}</td>
              <td className="p-2">{item.item_name}</td>
              <td className="p-2">{item.total_qty}</td>
              <td className="p-2">Rs {Number(item.total_amount).toLocaleString()}</td>
              <td className="p-2 text-green-600 font-medium">Rs {Number(item.total_profit).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
