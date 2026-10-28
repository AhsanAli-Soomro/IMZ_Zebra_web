'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'

export default function Quotations() {
  const [quotations, setQuotations] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)
  const [activeQuotation, setActiveQuotation] = useState(null)

  // Form State for creating new quotation
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [formData, setFormData] = useState({
    customer_id: '',
    customer_name: '',
    discount: 0,
    notes: '',
    items: [{ product_id: '', product_name: '', quantity: 1, unit_price: 0 }],
  })

  const fetchQuotations = async () => {
    setLoading(true)
    try {
      const res = await axios.get('/api/quotations', {
        params: { status: statusFilter, search: searchTerm },
      })
      if (res.data?.ok) {
        setQuotations(res.data.data || [])
      }
    } catch (err) {
      console.warn('Fetch quotations error:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchDependencies = async () => {
    try {
      const [cRes, pRes] = await Promise.all([
        axios.get('/api/customers'),
        axios.get('/api/stocks'),
      ])
      setCustomers(cRes.data?.data || cRes.data || [])
      setProducts(pRes.data?.data || pRes.data || [])
    } catch (err) {
      console.warn('Dependencies fetch error:', err)
    }
  }

  useEffect(() => {
    fetchQuotations()
  }, [statusFilter, searchTerm])

  useEffect(() => {
    fetchDependencies()
  }, [])

  // Line item handlers
  const handleAddItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { product_id: '', product_name: '', quantity: 1, unit_price: 0 }],
    }))
  }

  const handleRemoveItem = (idx) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }))
  }

  const handleItemChange = (idx, field, value) => {
    setFormData((prev) => {
      const next = [...prev.items]
      next[idx] = { ...next[idx], [field]: value }

      if (field === 'product_id') {
        const prod = products.find((p) => String(p.id) === String(value))
        if (prod) {
          next[idx].product_name = prod.name || prod.product_name
          next[idx].unit_price = Number(prod.sale_price || prod.price || 0)
        }
      }
      return { ...prev, items: next }
    })
  }

  const calculateSubtotal = () => {
    return formData.items.reduce(
      (sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
      0
    )
  }

  const calculateNetTotal = () => {
    return Math.max(0, calculateSubtotal() - Number(formData.discount || 0))
  }

  const handleSaveQuotation = async (e) => {
    e.preventDefault()
    if (formData.items.length === 0 || !formData.items[0].product_name) {
      alert('Please add at least one product item.')
      return
    }

    try {
      const res = await axios.post('/api/quotations', formData)
      if (res.data?.ok) {
        setIsModalOpen(false)
        setFormData({
          customer_id: '',
          customer_name: '',
          discount: 0,
          notes: '',
          items: [{ product_id: '', product_name: '', quantity: 1, unit_price: 0 }],
        })
        fetchQuotations()
      }
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to save quotation')
    }
  }

  const handleConvertToInvoice = async (quotation) => {
    if (!confirm(`Are you sure you want to convert Quotation ${quotation.quotation_number} into a real Sale Invoice? This will deduct inventory and update ledger.`)) {
      return
    }

    setActionLoading(quotation.id)
    try {
      const res = await axios.post(`/api/quotations/${quotation.id}/convert`)
      if (res.data?.ok) {
        alert(res.data.message || 'Quotation converted successfully!')
        fetchQuotations()
      }
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to convert quotation')
    } finally {
      setActionLoading(null)
    }
  }

  const handlePrint = (q) => {
    window.print()
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">Quotations & Sales Orders</h1>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
              Kacha Bill / Estimate
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Prepare customer price estimates and convert them into final Sale Invoices with 1 click.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-md transition-colors flex items-center gap-1.5 shrink-0"
        >
          <span>➕</span>
          <span>Create New Quotation</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {['all', 'draft', 'converted'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-colors ${
                statusFilter === st
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-72">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search quotation # or customer..."
            className="w-full px-3 py-1.5 text-xs rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Quotations Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-xs text-gray-400">Loading quotations...</div>
        ) : quotations.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-400">
            No quotations found. Click "Create New Quotation" to start.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Quotation #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4">Net Total</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {quotations.map((q) => {
                  const isConverted = q.status === 'converted'
                  return (
                    <tr key={q.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-gray-900">
                        {q.quotation_number}
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-800">
                        {q.customer_name || 'Walk-in Customer'}
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-[11px]">
                        {new Date(q.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-gray-600 font-medium">
                        {q.total_items || 1} items
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-800">
                        Rs. {Number(q.net_amount).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        {isConverted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            ✓ Converted (Bill #{q.converted_invoice_id})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            Draft (Estimate)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {!isConverted && (
                          <button
                            type="button"
                            onClick={() => handleConvertToInvoice(q)}
                            disabled={actionLoading === q.id}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-[11px] rounded-lg shadow-2xs transition-colors"
                          >
                            {actionLoading === q.id ? 'Converting...' : '⚡ Convert to Invoice'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create New Quotation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95">
            <div className="p-4 bg-gray-50 border-b flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Create New Quotation / Estimate</h3>
                <p className="text-[11px] text-gray-500">Draft prices for customer before billing</p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 font-bold text-lg"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveQuotation} className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Customer Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">
                    Select Customer
                  </label>
                  <select
                    value={formData.customer_id}
                    onChange={(e) => {
                      const cid = e.target.value
                      const cust = customers.find((c) => String(c.id) === String(cid))
                      setFormData((prev) => ({
                        ...prev,
                        customer_id: cid,
                        customer_name: cust ? cust.name : prev.customer_name,
                      }))
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Walk-in / Custom Customer --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">
                    Customer Name (For slip)
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.customer_name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, customer_name: e.target.value }))
                    }
                    placeholder="e.g. Haji Akram Traders"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-800">Quotation Line Items</span>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-bold hover:bg-emerald-100"
                  >
                    ➕ Add Item
                  </button>
                </div>

                <div className="space-y-2">
                  {formData.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 bg-gray-50 p-2.5 rounded-xl border border-gray-200 items-center text-xs"
                    >
                      <div className="col-span-5">
                        <input
                          type="text"
                          placeholder="Item Name"
                          required
                          value={item.product_name}
                          onChange={(e) => handleItemChange(idx, 'product_name', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          placeholder="Qty"
                          min="0.1"
                          step="any"
                          required
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white text-center"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          placeholder="Price"
                          min="0"
                          step="any"
                          required
                          value={item.unit_price}
                          onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white text-right"
                        />
                      </div>
                      <div className="col-span-1 text-right">
                        {formData.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-red-500 hover:text-red-700 font-bold"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">
                    Notes / Terms
                  </label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="e.g. Valid for 7 days. Rates subject to mandi changes."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="bg-emerald-50/60 p-3 rounded-2xl border border-emerald-200 text-xs space-y-1.5">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal:</span>
                    <span className="font-bold">Rs. {calculateSubtotal().toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-600">Discount:</span>
                    <input
                      type="number"
                      min="0"
                      value={formData.discount}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, discount: Number(e.target.value) || 0 }))
                      }
                      className="w-24 px-2 py-1 text-right rounded-lg border border-emerald-300 bg-white font-bold"
                    />
                  </div>
                  <div className="flex justify-between text-sm font-bold text-emerald-950 pt-1 border-t border-emerald-200">
                    <span>Net Amount:</span>
                    <span>Rs. {calculateNetTotal().toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-md transition-colors"
                >
                  Save Quotation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
