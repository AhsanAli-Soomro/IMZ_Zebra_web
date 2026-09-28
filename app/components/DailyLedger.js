'use client'

import { useEffect, useMemo, useState } from 'react'

function today() {
  const now = new Date()
  const timezoneOffset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10)
}

function money(value) {
  return Number(value || 0).toLocaleString('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function partyRows(rows) {
  return rows.map((row) => ({
    id: row.id,
    name: row.party_name || '-',
    amount: Number(row.debit || 0) + Number(row.credit || 0),
    note: row.description || row.notes || '',
    entity: 'ledger',
  }))
}

function bankRows(rows, transactionType) {
  return rows
    .filter((row) => row.tx_type === transactionType && String(row.payment_method || '').toLowerCase() !== 'cash')
    .map((row) => ({
      id: row.id,
      name: row.source_of_payment || row.payment_method || 'Bank / Account',
      amount: Number(row.amount || 0),
      note: row.description || row.notes || '',
      entity: 'cash',
    }))
}

export default function DailyLedger() {
  const [date, setDate] = useState(today())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setError('')
      try {
        const response = await fetch(`/api/daily-ledger?date=${encodeURIComponent(date)}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        const json = await response.json()
        if (!response.ok || !json.success) throw new Error(json.message || 'Daily ledger could not be loaded.')
        setData(json.data)
      } catch (loadError) {
        if (loadError.name !== 'AbortError') setError(loadError.message || 'Daily ledger could not be loaded.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    if (date) load()
    return () => controller.abort()
  }, [date, refreshKey])

  const customerRows = useMemo(() => partyRows(data?.customerEntries || []), [data])
  const supplierRows = useMemo(() => partyRows(data?.supplierEntries || []), [data])
  const bankCreditRows = useMemo(() => bankRows(data?.cashTransactions || [], 'in'), [data])
  const bankDebitRows = useMemo(() => bankRows(data?.cashTransactions || [], 'out'), [data])
  const summary = data?.summary || {}

  async function editAmount(row) {
    const entered = window.prompt(`Enter a new amount for ${row.name}`, String(row.amount || 0))
    if (entered === null) return
    const amount = Number(entered)
    if (!Number.isFinite(amount) || amount < 0) {
      window.alert('Enter a valid amount.')
      return
    }

    try {
      const response = await fetch('/api/daily-ledger/edit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity: row.entity, id: row.id, amount }),
      })
      const json = await response.json()
      if (!response.ok || !json.success) throw new Error(json.message || 'Amount could not be updated.')
      setRefreshKey((value) => value + 1)
    } catch (editError) {
      window.alert(editError.message || 'Amount could not be updated.')
    }
  }

  return (
    <div className="space-y-7 p-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Daily Ledger</h1>
            <p className="mt-1 text-sm text-gray-500">View cash, customer, supplier, and bank activity for one selected date.</p>
          </div>
          <div className="w-full sm:w-64">
            <label htmlFor="daily-ledger-date" className="mb-1 block text-sm font-bold text-gray-700">Date</label>
            <input
              id="daily-ledger-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 font-semibold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>
      </section>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>}

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Cash in Hand" value={summary.cash_in_hand} tone="blue" helper={`Closing cash as of ${date || 'the selected date'}`} />
        <SummaryCard label="Credit" value={summary.day_credit} tone="green" helper="Cash and bank credit on this date" />
        <SummaryCard label="Debit" value={summary.day_debit} tone="red" helper="Cash and bank debit on this date" />
      </section>

      {loading && <div className="rounded-lg border bg-gray-50 p-3 text-sm text-gray-600">Loading daily ledger...</div>}

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <SnapshotList title="Customers" rows={customerRows} empty="No customer activity on this date." tone="indigo" onEdit={editAmount} />
        <SnapshotList title="Suppliers" rows={supplierRows} empty="No supplier activity on this date." tone="orange" onEdit={editAmount} />
        <SnapshotList title="Banks — Credit" rows={bankCreditRows} empty="No bank credit on this date." tone="green" onEdit={editAmount} />
        <SnapshotList title="Banks — Debit" rows={bankDebitRows} empty="No bank debit on this date." tone="red" onEdit={editAmount} />
      </section>
    </div>
  )
}

function SummaryCard({ label, value, tone, helper }) {
  const styles = {
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
    green: 'border-green-200 bg-green-50 text-green-900',
    red: 'border-red-200 bg-red-50 text-red-900',
  }

  return (
    <article className={`rounded-2xl border p-5 shadow-sm ${styles[tone]}`}>
      <p className="text-sm font-bold uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-3xl font-extrabold">Rs {money(value)}</p>
      <p className="mt-1 text-xs opacity-75">{helper}</p>
    </article>
  )
}

function SnapshotList({ title, rows, empty, tone, onEdit }) {
  const headerStyles = {
    indigo: 'bg-indigo-700',
    orange: 'bg-orange-600',
    green: 'bg-green-700',
    red: 'bg-red-700',
  }
  const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0)

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className={`flex items-center justify-between px-4 py-3 text-white ${headerStyles[tone]}`}>
        <div>
          <h2 className="font-bold">{title}</h2>
          <p className="text-xs text-white/80">{rows.length} {rows.length === 1 ? 'entry' : 'entries'}</p>
        </div>
        <p className="text-right text-sm font-bold">Rs {money(total)}</p>
      </div>
      <div className="max-h-[440px] divide-y overflow-y-auto">
        {rows.length ? rows.map((row) => (
          <div key={`${row.entity}-${row.id}`} className="px-4 py-3 hover:bg-gray-50">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-gray-900" title={row.name}>{row.name}</p>
                {row.note && <p className="mt-0.5 truncate text-xs text-gray-500" title={row.note}>{row.note}</p>}
              </div>
              <div className="shrink-0 text-right">
                <p className="font-bold text-gray-900">Rs {money(row.amount)}</p>
                <button type="button" onClick={() => onEdit(row)} className="mt-1 rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700 hover:bg-blue-100">Edit</button>
              </div>
            </div>
          </div>
        )) : <p className="px-4 py-10 text-center text-sm text-gray-500">{empty}</p>}
      </div>
    </section>
  )
}
