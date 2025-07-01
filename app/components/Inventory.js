'use client'
import { useEffect, useState } from 'react'

const ITEMS_PER_PAGE = 20

export default function Inventory() {
  const [stocks, setStocks] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showLowStockOnly, setShowLowStockOnly] = useState(false)
  const [showExpiringSoonOnly, setShowExpiringSoonOnly] = useState(false)

  useEffect(() => {
    const fetchStocks = async () => {
      try {
        const res = await fetch('/api/stocks')
        const json = await res.json()
        if (json.success) {
          setStocks(json.data)
        }
      } catch (err) {
        console.error('Error loading stock:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchStocks()
  }, [])

  const isExpiringSoon = (dateStr) => {
    const today = new Date()
    const expiry = new Date(dateStr)
    const diffDays = (expiry - today) / (1000 * 60 * 60 * 24)
    return diffDays >= 0 && diffDays <= 7
  }

  const isLowStock = (quantity) => Number(quantity) <= 5

  const filteredStocks = stocks
    .filter((stock) => {
      const lowStock = isLowStock(stock.quantity)
      const expiringSoon = isExpiringSoon(stock.expire_date)

      if (showLowStockOnly && !lowStock) return false
      if (showExpiringSoonOnly && !expiringSoon) return false

      return true
    })
    .sort((a, b) => {
      const aExp = new Date(a.expire_date)
      const bExp = new Date(b.expire_date)
      return aExp - bExp
    })

  const totalPages = Math.ceil(filteredStocks.length / ITEMS_PER_PAGE)
  const start = (currentPage - 1) * ITEMS_PER_PAGE
  const end = start + ITEMS_PER_PAGE
  const paginatedStocks = filteredStocks.slice(start, end)

  const nextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1)
  }

  const prevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1)
  }

  if (loading) return <p>Loading stock...</p>

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-indigo-700">📦 Inventory</h1>
        <a
          href="/dashboard?view=stock"
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-md"
        >
          + Add Stock
        </a>
      </div>

      {/* Legend & Filters */}
      <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showExpiringSoonOnly}
              onChange={() => {
                setShowExpiringSoonOnly(!showExpiringSoonOnly)
                setCurrentPage(1)
              }}
              className="form-checkbox h-4 w-4 text-yellow-500"
            />
            <div className="w-4 h-4 bg-yellow-200 border border-yellow-400 rounded" />
            <span>Expiring in 7 days</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showLowStockOnly}
              onChange={() => {
                setShowLowStockOnly(!showLowStockOnly)
                setCurrentPage(1)
              }}
              className="form-checkbox h-4 w-4 text-red-500"
            />
            <div className="w-4 h-4 bg-red-200 border border-red-400 rounded" />
            <span>Low Stock (≤ 5)</span>
          </div>
        </div>
      </div>

      <div className="overflow-auto rounded-md border border-gray-200">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-indigo-600 text-white">
            <tr>
              <th className="p-3">Image</th>
              <th className="p-3">Item Code</th>
              <th className="p-3">Item Name</th>
              <th className="p-3">Category</th>
              <th className="p-3">Quantity</th>
              <th className="p-3">Purchase Price</th>
              <th className="p-3">Selling Price</th>
              <th className="p-3">Expire Date</th>
              <th className="p-3">Supplier</th>
              <th className="p-3">Purchase Date</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {paginatedStocks.map((stock, i) => {
              const isLow = isLowStock(stock.quantity)
              const isExpSoon = isExpiringSoon(stock.expire_date)

              let rowClass = ''
              if (isExpSoon) rowClass = 'bg-yellow-100'
              else if (isLow) rowClass = 'bg-red-100'
              else rowClass = i % 2 === 0 ? 'bg-white' : 'bg-gray-50'

              return (
                <tr
                  key={stock.id}
                  className={`transition duration-200 ${rowClass} hover:bg-indigo-50`}
                >
                  <td className="p-3">
                    {stock.image_path ? (
                      <img
                        src={stock.image_path}
                        alt={stock.item_name}
                        className="w-12 h-12 object-cover rounded border"
                      />
                    ) : (
                      <span className="text-gray-400">No image</span>
                    )}
                  </td>
                  <td className="p-3">{stock.item_code}</td>
                  <td className="p-3 font-medium">{stock.item_name}</td>
                  <td className="p-3">{stock.category}</td>
                  <td className="p-3 font-semibold">{stock.quantity}</td>
                  <td className="p-3 text-blue-700 font-semibold">
                    Rs {Number(stock.purchase_price).toLocaleString()}
                  </td>
                  <td className="p-3 text-blue-700 font-semibold">
                    Rs {Number(stock.selling_price).toLocaleString()}
                  </td>
                  <td className="p-3">{new Date(stock.expire_date).toLocaleDateString()}</td>
                  <td className="p-3">{stock.supplier_name}</td>
                  <td className="p-3">{new Date(stock.purchase_date).toLocaleDateString()}</td>
                  <td
                    className={`p-3 font-medium ${stock.status === 'Active' ? 'text-green-600' : 'text-red-600'
                      }`}
                  >
                    {stock.status}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex justify-between items-center">
        <button
          onClick={prevPage}
          disabled={currentPage === 1}
          className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-sm disabled:opacity-50"
        >
          Previous
        </button>

        <span className="text-sm text-gray-700">
          Page {currentPage} of {totalPages}
        </span>

        <button
          onClick={nextPage}
          disabled={currentPage === totalPages || totalPages === 0}
          className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-sm disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  )
}
