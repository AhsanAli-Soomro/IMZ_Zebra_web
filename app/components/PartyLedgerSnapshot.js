'use client'

import { useEffect, useMemo, useState } from 'react'

function localToday() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function money(value) {
  return Number(value || 0).toLocaleString('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

export default function PartyLedgerSnapshot({ type, onOpen }) {
  const isCustomer = type === 'customer'
  const partyLabel = isCustomer ? 'Customer' : 'Supplier'
  const [date, setDate] = useState(localToday())
  const [search, setSearch] = useState('')
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError('')
      try {
        const response = await fetch(`/api/ledger/history?type=${type}`, { cache: 'no-store' })
        const json = await response.json()
        if (!response.ok || !json.success) throw new Error(json.message || 'Ledger could not be loaded.')
        if (active) setEntries(json.data?.entries || [])
      } catch (loadError) {
        if (active) setError(loadError.message || 'Ledger could not be loaded.')
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => { active = false }
  }, [type])

  const datedRows = useMemo(() => {
    const grouped = new Map()

    entries.forEach((entry) => {
      if (date && String(entry.entry_date || '') > date) return
      const id = String(entry.party_id)
      const current = grouped.get(id) || {
        id,
        name: entry.party_name || `${partyLabel} ${id}`,
        debit: 0,
        credit: 0,
      }
      current.debit += Number(entry.debit || 0)
      current.credit += Number(entry.credit || 0)
      grouped.set(id, current)
    })

    return [...grouped.values()]
      .map((row) => ({
        ...row,
        balance: isCustomer ? row.debit - row.credit : row.credit - row.debit,
      }))
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
  }, [entries, date, isCustomer, partyLabel])

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return datedRows.filter((row) => !query || row.name.toLowerCase().includes(query))
  }, [datedRows, search])

  const totals = useMemo(() => rows.reduce((sum, row) => ({
    debit: sum.debit + row.debit,
    credit: sum.credit + row.credit,
    balance: sum.balance + row.balance,
  }), { debit: 0, credit: 0, balance: 0 }), [datedRows])

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{partyLabel} Ledger</h2>
          <p className="text-sm text-gray-500">Selected date tak debit, credit aur closing balance.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Ledger Date</label>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Search {partyLabel}</label>
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Type ${partyLabel.toLowerCase()} name...`} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200" />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-red-200 bg-red-50 p-3"><p className="text-xs text-red-700">Total Debit</p><p className="text-xl font-bold text-red-800">Rs {money(totals.debit)}</p></div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-3"><p className="text-xs text-green-700">Total Credit</p><p className="text-xl font-bold text-green-800">Rs {money(totals.credit)}</p></div>
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3"><p className="text-xs text-indigo-700">Closing Balance</p><p className="text-xl font-bold text-indigo-800">Rs {money(totals.balance)}</p></div>
      </div>

      <div className="mt-4 max-h-[420px] overflow-auto rounded-lg border">
        <table className="w-full min-w-[650px] text-sm">
          <thead className="sticky top-0 bg-gray-900 text-white">
            <tr><th className="px-4 py-3 text-left">{partyLabel}</th><th className="px-4 py-3 text-right">Debit</th><th className="px-4 py-3 text-right">Credit</th><th className="px-4 py-3 text-right">Balance</th><th className="px-4 py-3 text-center">Action</th></tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan="5" className="px-4 py-8 text-center text-gray-500">Loading ledger...</td></tr>
              : error ? <tr><td colSpan="5" className="px-4 py-8 text-center text-red-600">{error}</td></tr>
                : rows.length ? rows.map((row, index) => (
                  <tr key={row.id} className={`border-t ${index % 2 ? 'bg-gray-50' : 'bg-white'}`}>
                    <td className="px-4 py-3 font-semibold">{row.name}</td>
                    <td className="px-4 py-3 text-right text-red-700">{row.debit ? `Rs ${money(row.debit)}` : '-'}</td>
                    <td className="px-4 py-3 text-right text-green-700">{row.credit ? `Rs ${money(row.credit)}` : '-'}</td>
                    <td className={`px-4 py-3 text-right font-bold ${row.balance > 0 ? 'text-indigo-700' : row.balance < 0 ? 'text-orange-700' : 'text-gray-600'}`}>Rs {money(row.balance)}</td>
                    <td className="px-4 py-3 text-center"><button type="button" onClick={() => onOpen?.(row.id)} className="rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white hover:bg-blue-700">Open Ledger</button></td>
                  </tr>
                )) : <tr><td colSpan="5" className="px-4 py-8 text-center text-gray-500">Is date tak koi ledger entry nahi mili.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
