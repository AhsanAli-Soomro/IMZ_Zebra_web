'use client'
import { React, useEffect, useState } from 'react'

const ITEMS_PER_PAGE = 20

export default function Inventory() {
  const [stocks, setStocks] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showLowStockOnly, setShowLowStockOnly] = useState(false)

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

  // Filter logic
  const filteredStocks = showLowStockOnly
    ? stocks.filter((s) => s.quantity <= 5)
    : stocks

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

  const handleFilterChange = () => {
    setShowLowStockOnly(!showLowStockOnly)
    setCurrentPage(1) // Reset to first page when filter changes
  }

  if (loading) return <p>Loading stock...</p>

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Inventory</h1>
        <a href="/dashboard?view=stock" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
          Add Stock
        </a>
      </div>

      <div className="flex items-center justify-between mb-4">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={showLowStockOnly}
            onChange={handleFilterChange}
            className="form-checkbox h-4 w-4"
          />
          <span>Show Low Stock Only</span>
        </label>
        <span className="text-gray-600">Total Items: {filteredStocks.length}</span>
      </div>

      <div className="overflow-auto">
        <table className="min-w-full border border-gray-300">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 border">Image</th>
              <th className="p-2 border">Item Code</th>
              <th className="p-2 border">Item Name</th>
              <th className="p-2 border">Category</th>
              <th className="p-2 border">Quantity</th>
              <th className="p-2 border">Purchase Price</th>
              <th className="p-2 border">Selling Price</th>
              <th className="p-2 border">Supplier</th>
              <th className="p-2 border">Purchase Date</th>
              <th className="p-2 border">Status</th>
            </tr>
          </thead>
          <tbody>
            {paginatedStocks.map((stock) => (
              <tr
                key={stock.id}
                className={stock.quantity <= 5 ? 'bg-red-100' : ''}
              >
                <td className="p-2 border">
                  {stock.image_path ? (
                    <img
                      src={stock.image_path}
                      alt={stock.item_name}
                      className="w-12 h-12 object-cover"
                    />
                  ) : (
                    'No image'
                  )}
                </td>
                <td className="p-2 border">{stock.item_code}</td>
                <td className="p-2 border">{stock.item_name}</td>
                <td className="p-2 border">{stock.category}</td>
                <td className="p-2 border">{stock.quantity}</td>
                <td className="p-2 border">{stock.purchase_price}</td>
                <td className="p-2 border">{stock.selling_price}</td>
                <td className="p-2 border">{stock.supplier_name}</td>
                <td className="p-2 border">
                  {new Date(stock.purchase_date).toLocaleDateString()}
                </td>
                <td className="p-2 border">{stock.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-between items-center">
        <button
          onClick={prevPage}
          disabled={currentPage === 1}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
        >
          Previous
        </button>
        <span>
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={nextPage}
          disabled={currentPage === totalPages || totalPages === 0}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  )
}
