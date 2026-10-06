'use client'

import { useEffect, useMemo, useState } from 'react'

const today = () => {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

const number = (value) => Number(value || 0).toLocaleString()

export default function StoreMovementHistory({ compact = false }) {
  const [dateFrom, setDateFrom] = useState(today())
  const [dateTo, setDateTo] = useState(today())
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [selectedStore, setSelectedStore] = useState(null)
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')

  const query = () => {
    const params = new URLSearchParams()
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)
    return params
  }

  const loadSummary = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/stores/history?${query()}`, { cache: 'no-store' })
      const json = await response.json()
      if (!response.ok || !json.success) throw new Error(json.message || 'Store history could not be loaded.')
      setRows(json.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSummary()
  }, [dateFrom, dateTo])

  const filteredRows = useMemo(() => {
    const value = search.trim().toLowerCase()
    if (!value) return rows
    return rows.filter((row) =>
      [row.store_code, row.store_name, row.address]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value))
    )
  }, [rows, search])

  const openStore = async (store) => {
    setSelectedStore(store)
    setDetailLoading(true)
    setMovements([])
    try {
      const params = query()
      params.set('storeId', store.store_id)
      const response = await fetch(`/api/stores/history?${params}`, { cache: 'no-store' })
      const json = await response.json()
      if (!response.ok || !json.success) throw new Error(json.message || 'Movement details could not be loaded.')
      setMovements(json.data || [])
    } catch (err) {
      setError(err.message)
      setSelectedStore(null)
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <div className={compact ? 'mt-6' : 'space-y-4'}>
      <div className="bg-white border rounded-xl shadow-sm p-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div><h2 className="text-lg font-semibold">Store-wise Stock Tracking</h2><p className="text-sm text-gray-500">Current balance aur selected dates ki inward/outward quantity.</p></div>
          <div className="flex flex-col sm:flex-row gap-3">
            <label className="text-xs font-semibold text-gray-600">Search Store<input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Code, name or address" className="mt-1 block border rounded-lg px-3 py-2 text-sm min-w-56" /></label>
            <label className="text-xs font-semibold text-gray-600">From<input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1 block border rounded-lg px-3 py-2 text-sm" /></label>
            <label className="text-xs font-semibold text-gray-600">To<input type="date" value={dateTo} min={dateFrom} onChange={(e) => setDateTo(e.target.value)} className="mt-1 block border rounded-lg px-3 py-2 text-sm" /></label>
          </div>
        </div>
      </div>

      {error && <div className="border border-red-200 bg-red-50 text-red-700 rounded-lg p-3 text-sm">{error}</div>}
      <div className="bg-white border rounded-xl shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-indigo-600 text-white"><tr><th className="p-3 text-left">Store</th><th className="p-3 text-right">Stock Items</th><th className="p-3 text-right">Current Qty</th><th className="p-3 text-right">Added</th><th className="p-3 text-right">Out</th><th className="p-3 text-right">Movements</th><th className="p-3 text-left">Action</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={7} className="p-6 text-center text-gray-500">Loading store history...</td></tr> : filteredRows.length ? filteredRows.map((row, index) => (
              <tr key={row.store_id} onClick={() => openStore(row)} className={`border-t cursor-pointer hover:bg-indigo-50 ${index % 2 ? 'bg-gray-50' : 'bg-white'}`}>
                <td className="p-3 font-medium">{row.store_code} — {row.store_name}</td><td className="p-3 text-right">{number(row.stock_items)}</td><td className="p-3 text-right font-semibold">{number(row.current_quantity)}</td><td className="p-3 text-right text-green-700">+{number(row.in_quantity)}</td><td className="p-3 text-right text-red-600">-{number(row.out_quantity)}</td><td className="p-3 text-right">{number(row.movement_count)}</td><td className="p-3"><button type="button" className="text-indigo-600 font-medium">View Details</button></td>
              </tr>
            )) : <tr><td colSpan={7} className="p-6 text-center text-gray-500">No stores found.</td></tr>}
          </tbody>
        </table>
      </div>

      {selectedStore && <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setSelectedStore(null)}><div className="bg-white w-full max-w-6xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start gap-3 p-4 sm:p-5 border-b bg-indigo-50"><div className="min-w-0"><h3 className="font-bold text-base sm:text-lg">{selectedStore.store_name} — Stock Movement Detail</h3><p className="text-xs sm:text-sm text-gray-600">{dateFrom || 'Beginning'} to {dateTo || 'Today'} · Added {number(selectedStore.in_quantity)} · Out {number(selectedStore.out_quantity)}</p></div><button onClick={() => setSelectedStore(null)} className="shrink-0 text-2xl text-gray-500">×</button></div>
        <div className="overflow-auto max-h-[calc(90vh-85px)]"><table className="min-w-[720px] text-sm"><thead className="sticky top-0 bg-gray-100"><tr><th className="p-3 text-left">Date</th><th className="p-3 text-left">Stock</th><th className="p-3 text-left">Movement</th><th className="p-3 text-right">Qty</th><th className="p-3 text-left">Reference</th><th className="p-3 text-left">Notes</th></tr></thead><tbody>
          {detailLoading ? <tr><td colSpan={6} className="p-6 text-center">Loading...</td></tr> : movements.length ? movements.map((movement) => <tr key={movement.id} className="border-t"><td className="p-3">{movement.movement_date}</td><td className="p-3"><div className="font-medium">{movement.item_name}</div><div className="text-xs text-gray-500">{movement.item_code}</div></td><td className={`p-3 font-semibold ${movement.direction === 'in' ? 'text-green-700' : 'text-red-600'}`}>{movement.direction === 'in' ? 'Stock Added' : 'Stock Out'}</td><td className={`p-3 text-right font-bold ${movement.direction === 'in' ? 'text-green-700' : 'text-red-600'}`}>{movement.direction === 'in' ? '+' : '-'}{number(movement.qty)}</td><td className="p-3">{movement.reference_type || '-'}{movement.reference_id ? ` #${movement.reference_id}` : ''}</td><td className="p-3">{movement.notes || '-'}</td></tr>) : <tr><td colSpan={6} className="p-6 text-center text-gray-500">Selected dates mein koi stock movement nahi hai.</td></tr>}
        </tbody></table></div>
      </div></div>}
    </div>
  )
}
