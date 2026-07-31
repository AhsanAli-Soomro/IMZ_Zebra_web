'use client'

import { useEffect, useState } from 'react'
import { getStoredUser } from '@/lib/storage'

const today = () => new Date().toLocaleDateString('en-CA')
const money = (value) => `Rs. ${Number(value || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`

function statusFor(variance) {
  const value = Number(variance || 0)
  if (Math.abs(value) < 0.005) return { label: 'Matched', classes: 'bg-green-100 text-green-700' }
  if (value < 0) return { label: 'Short', classes: 'bg-red-100 text-red-700' }
  return { label: 'Excess', classes: 'bg-amber-100 text-amber-700' }
}

export default function CounterClosing() {
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState({ physical: 0, expected: 0, variance: 0, count: 0 })
  const [form, setForm] = useState({ id: null, closing_date: today(), physical_amount: '', notes: '' })
  const [expected, setExpected] = useState(0)
  const [filters, setFilters] = useState({ search: '', dateFrom: '', dateTo: '', status: '', minAmount: '', maxAmount: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  async function loadRows() {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => value !== '' && qs.set(key, value))
      const res = await fetch(`/api/counter-closings?${qs}`)
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Could not load closings')
      setRows(json.data || [])
      setSummary(json.summary || {})
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(loadRows, 250)
    return () => clearTimeout(timer)
  }, [filters])

  useEffect(() => {
    if (!form.closing_date) return
    const controller = new AbortController()
    fetch(`/api/counter-closings?previewDate=${form.closing_date}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => json.success && setExpected(Number(json.previewExpected || 0)))
      .catch((error) => error.name !== 'AbortError' && setMessage({ type: 'error', text: error.message }))
    return () => controller.abort()
  }, [form.closing_date])

  async function submit(event) {
    event.preventDefault()
    setMessage({ type: '', text: '' })
    const amount = Number(form.physical_amount)
    if (form.physical_amount === '' || !Number.isFinite(amount) || amount < 0) {
      setMessage({ type: 'error', text: 'Please enter a valid counter amount.' })
      return
    }
    setSaving(true)
    try {
      const user = getStoredUser()
      const editing = Boolean(form.id)
      const res = await fetch('/api/counter-closings', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, physical_amount: amount, [editing ? 'updated_by' : 'created_by']: user?.id || null }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Could not save closing')
      setMessage({ type: 'success', text: json.message })
      setForm({ id: null, closing_date: today(), physical_amount: '', notes: '' })
      await loadRows()
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setSaving(false)
    }
  }

  function edit(row) {
    setForm({ id: row.id, closing_date: row.closing_date, physical_amount: String(row.physical_amount), notes: row.notes || '' })
    setExpected(Number(row.expected_amount || 0))
    setMessage({ type: '', text: '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() {
    setForm({ id: null, closing_date: today(), physical_amount: '', notes: '' })
    setMessage({ type: '', text: '' })
  }

  const entered = form.physical_amount === '' ? null : Number(form.physical_amount)
  const variance = entered === null || !Number.isFinite(entered) ? null : entered - expected

  return (
    <div className="p-2 md:p-6 space-y-6 text-gray-800">
      <div>
        <h1 className="text-2xl font-bold">Cash in Hand</h1>
        <p className="text-sm text-gray-500 mt-1">Record physical cash at closing time and reconcile it with the system cash book.</p>
      </div>

      <form onSubmit={submit} className="bg-white border rounded-2xl shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-lg">{form.id ? 'Edit Closing' : 'New Closing Entry'}</h2>
          {form.id && <button type="button" onClick={resetForm} className="text-sm text-indigo-600 hover:underline">Cancel edit</button>}
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <label className="text-sm font-medium">Closing Date
            <input required type="date" max={today()} value={form.closing_date} onChange={(e) => setForm({ ...form, closing_date: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2.5 font-normal" />
          </label>
          <label className="text-sm font-medium">Cash in Hand (PKR)
            <input required min="0" step="0.01" type="number" value={form.physical_amount} onChange={(e) => setForm({ ...form, physical_amount: e.target.value })} placeholder="Enter counted amount" className="mt-1 w-full border rounded-lg px-3 py-2.5 font-normal" />
          </label>
          <label className="text-sm font-medium">Notes (optional)
            <input maxLength="500" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Shift or reconciliation note" className="mt-1 w-full border rounded-lg px-3 py-2.5 font-normal" />
          </label>
        </div>
        {/* <div className="grid sm:grid-cols-3 gap-3 bg-gray-50 rounded-xl p-4">
          <div><p className="text-xs text-gray-500">System Expected Cash</p><p className="font-bold">{money(expected)}</p></div>
          <div><p className="text-xs text-gray-500">Physical Cash</p><p className="font-bold">{entered === null ? '—' : money(entered)}</p></div>
          <div><p className="text-xs text-gray-500">Difference</p><p className={`font-bold ${variance < 0 ? 'text-red-600' : variance > 0 ? 'text-amber-600' : 'text-green-600'}`}>{variance === null ? '—' : money(variance)}</p></div>
        </div> */}
        {/* {message.text && <div className={`rounded-lg px-4 py-3 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{message.text}</div>} */}
        <button disabled={saving} className="rounded-lg bg-indigo-600 text-white px-5 py-2.5 font-medium hover:bg-indigo-700 disabled:opacity-60">{saving ? 'Saving...' : form.id ? 'Update Closing' : 'Save Closing'}</button>
      </form>

      {/* <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Filtered Closings', summary.count, 'bg-slate-50 text-slate-800'],
          ['Total Physical', money(summary.physical), 'bg-blue-50 text-blue-800'],
          ['Total Expected', money(summary.expected), 'bg-indigo-50 text-indigo-800'],
          ['Net Difference', money(summary.variance), Number(summary.variance) < 0 ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'],
        ].map(([label, value, color]) => <div key={label} className={`border rounded-xl p-4 ${color}`}><p className="text-xs opacity-75">{label}</p><p className="text-xl font-bold mt-1">{value}</p></div>)}
      </div> */}

      <section className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="font-semibold mb-3">Closing History</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-7 gap-2">
            <input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Search notes or user" className="border rounded-lg px-3 py-2 text-sm lg:col-span-2" />
            <input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" title="From date" />
            <input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" title="To date" />
            {/* <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="border rounded-lg px-3 py-2 text-sm"><option value="">All Statuses</option><option value="matched">Matched</option><option value="short">Short</option><option value="excess">Excess</option></select> */}
            {/* <input type="number" min="0" value={filters.minAmount} onChange={(e) => setFilters({ ...filters, minAmount: e.target.value })} placeholder="Min amount" className="border rounded-lg px-3 py-2 text-sm" /> */}
            {/* <input type="number" min="0" value={filters.maxAmount} onChange={(e) => setFilters({ ...filters, maxAmount: e.target.value })} placeholder="Max amount" className="border rounded-lg px-3 py-2 text-sm" /> */}
          </div>
          <button type="button" onClick={() => setFilters({ search: '', dateFrom: '', dateTo: '', status: '', minAmount: '', maxAmount: '' })} className="mt-2 text-sm text-indigo-600 hover:underline">Clear all filters</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left p-3">Date</th>
                {/* <th className="text-right p-3">Expected</th> */}
                <th className="text-right p-3">Closed Cash</th>
                {/* <th className="text-right p-3">Difference</th> */}
                {/* <th className="text-left p-3">Status</th> */}
                <th className="text-left p-3">Closed By</th>
                <th className="text-left p-3">Notes</th>
                <th className="text-right p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan="8" className="p-8 text-center text-gray-500">Loading cash history...</td></tr> : rows.length === 0 ? <tr><td colSpan="8" className="p-8 text-center text-gray-500">No Cash in Hand record found for these filters.</td></tr> : rows.map((row) => {
                const status = statusFor(row.variance)
                return <tr key={row.id} className="border-t hover:bg-gray-50">
                  <td className="p-3 whitespace-nowrap font-medium">{row.closing_date}</td>
                  {/* <td className="p-3 text-right">{money(row.expected_amount)}</td> */}
                  <td className="p-3 text-right font-semibold">{money(row.physical_amount)}</td>
                  {/* <td className={`p-3 text-right font-semibold ${row.variance < 0 ? 'text-red-600' : row.variance > 0 ? 'text-amber-600' : 'text-green-600'}`}>{money(row.variance)}</td> */}
                  {/* <td className="p-3"><span className={`px-2 py-1 rounded-full text-xs ${status.classes}`}>{status.label}</span></td> */}
                  <td className="p-3 whitespace-nowrap">{row.closed_by_name}</td><td className="p-3 max-w-56 truncate" title={row.notes || ''}>{row.notes || '—'}</td>
                  <td className="p-3 text-right"><button type="button" onClick={() => edit(row)} className="text-indigo-600 font-medium hover:underline">Edit</button></td>
                </tr>
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
