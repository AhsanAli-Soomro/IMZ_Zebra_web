'use client'

import { useEffect, useState } from 'react'

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

function EmptyRow({ columns, text }) {
  return <tr><td colSpan={columns} className="p-5 text-center text-gray-500">{text}</td></tr>
}

function partyRows(rows) {
  return rows.map((row) => ({
    id: row.id,
    name: row.party_name || '-',
    amount: Number(row.debit || 0) || Number(row.credit || 0),
    entity: 'ledger',
  }))
}

function groupBankRows(rows, transactionType) {
  const grouped = new Map()
  rows
    .filter((row) => row.tx_type === transactionType && String(row.payment_method || '').toLowerCase() !== 'cash')
    .forEach((row) => {
      const name = row.source_of_payment || row.payment_method || 'Bank / Account'
      grouped.set(String(row.id), { id: row.id, name, amount: Number(row.amount || 0), entity: 'cash' })
    })
  return [...grouped.values()]
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
        if (!response.ok || !json.success) throw new Error(json.message || 'Ledger load failed')
        setData(json.data)
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message || 'Ledger load failed')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    if (date) load()
    return () => controller.abort()
  }, [date, refreshKey])

  const summary = data?.summary || {}
  const customerRows = partyRows(data?.customerEntries || [])
  const supplierRows = partyRows(data?.supplierEntries || [])
  const bankCreditRows = groupBankRows(data?.cashTransactions || [], 'in')
  const bankDebitRows = groupBankRows(data?.cashTransactions || [], 'out')

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
    <div className="space-y-6 p-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Daily Ledger Overview</h1>
          <p className="text-sm text-gray-500">
            Kisi bhi date ka complete cash, sale, purchase, customer aur supplier record.
          </p>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Ledger Date</label>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="min-w-56 border rounded-lg px-3 py-2 bg-white"
          />
        </div>
      </div>
      </div>

      {error && <div className="border border-red-200 bg-red-50 text-red-700 rounded-lg p-3">{error}</div>}
      {loading && <div className="border bg-gray-50 rounded-lg p-3 text-gray-600">Ledger loading...</div>}

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Cash in Hand" value={summary.cash_in_hand} color="blue" />
        <SummaryCard label="Credit / Cash In" value={summary.day_credit} color="green" />
        <SummaryCard label="Debit / Cash Out" value={summary.day_debit} color="red" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OverviewList title="Customers" rows={customerRows} empty="No customer entry exists for this date." tone="indigo" onEdit={editAmount} />
        <OverviewList title="Suppliers" rows={supplierRows} empty="No supplier entry exists for this date." tone="orange" onEdit={editAmount} />
        <OverviewList title="Banks — Credit" rows={bankCreditRows} empty="No bank credit exists for this date." tone="green" onEdit={editAmount} />
        <OverviewList title="Banks — Debit" rows={bankDebitRows} empty="No bank debit exists for this date." tone="red" onEdit={editAmount} />
      </div>

      {data?.closing && (
        <div className="border rounded-xl bg-cyan-50 p-4">
          <h2 className="font-bold mb-2">Cash in Hand Closing</h2>
          <div className="grid sm:grid-cols-3 gap-3 text-sm">
            <p>Physical: <b>Rs {money(data.closing.physical_amount)}</b></p>
            <p>Expected: <b>Rs {money(data.closing.expected_amount)}</b></p>
            <p>Difference: <b>Rs {money(data.closing.variance)}</b></p>
          </div>
        </div>
      )}

      <LedgerTable title="Cash Debit / Credit" headers={['Type', 'Category', 'Source', 'Method', 'Amount', 'Description']}>
        {(data?.cashTransactions || []).map((row) => (
          <tr key={row.id} className="border-t">
            <td className={`p-3 font-semibold ${row.tx_type === 'in' ? 'text-green-700' : 'text-red-700'}`}>
              {row.tx_type === 'in' ? 'Credit / Cash In' : 'Debit / Cash Out'}
            </td>
            <td className="p-3">{row.category || '-'}</td>
            <td className="p-3">{row.source_of_payment || '-'}</td>
            <td className="p-3">{row.payment_method || '-'}</td>
            <td className="p-3 font-semibold">Rs {money(row.amount)}</td>
            <td className="p-3">{row.description || row.notes || '-'}</td>
          </tr>
        ))}
        {!data?.cashTransactions?.length && <EmptyRow columns={6} text="No cash transaction exists for this date." />}
      </LedgerTable>

      <InvoiceTable title="Sales & Customers" rows={data?.sales || []} partyKey="customer_name" partyLabel="Customer" />
      <InvoiceTable title="Purchases & Suppliers / Sellers" rows={data?.purchases || []} partyKey="supplier_name" partyLabel="Supplier / Seller" />
      <PartyTable title="Customer Ledger Entries" rows={data?.customerEntries || []} />
      <PartyTable title="Supplier / Seller Ledger Entries" rows={data?.supplierEntries || []} />
    </div>
  )
}

function SummaryCard({ label, value, color }) {
  const colors = {
    blue: 'border-blue-200 bg-blue-50 text-blue-800',
    green: 'border-green-200 bg-green-50 text-green-800',
    red: 'border-red-200 bg-red-50 text-red-800',
  }
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${colors[color]}`}>
      <p className="text-sm font-bold uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-3xl font-extrabold">Rs {money(value)}</p>
    </div>
  )
}

function OverviewList({ title, rows, empty, tone, onEdit }) {
  const headerColors = {
    indigo: 'bg-indigo-600', orange: 'bg-orange-600', green: 'bg-green-600', red: 'bg-red-600',
  }
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className={`flex items-center justify-between px-4 py-3 text-white ${headerColors[tone]}`}>
        <h2 className="font-bold">{title}</h2>
        <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold">{rows.length}</span>
      </div>
      <div className="max-h-80 divide-y overflow-y-auto">
        {rows.length ? rows.map((row) => (
          <div key={row.id || row.name} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
            <span className="min-w-0 truncate font-medium text-gray-800" title={row.name}>{row.name}</span>
            <span className={`ml-auto shrink-0 font-bold ${Number(row.amount) < 0 ? 'text-red-700' : 'text-gray-900'}`}>
              Rs {money(row.amount)}
            </span>
            <button type="button" onClick={() => onEdit(row)} className="shrink-0 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100">Edit</button>
          </div>
        )) : <p className="px-4 py-8 text-center text-sm text-gray-500">{empty}</p>}
      </div>
    </section>
  )
}

function LedgerTable({ title, headers, children }) {
  return (
    <section className="border rounded-xl bg-white overflow-hidden">
      <h2 className="font-bold p-4 bg-gray-50 border-b">{title}</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100"><tr>{headers.map((header) => <th key={header} className="p-3 text-left">{header}</th>)}</tr></thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </section>
  )
}

function InvoiceTable({ title, rows, partyKey, partyLabel }) {
  return (
    <LedgerTable title={title} headers={['Invoice', partyLabel, 'Total', 'Paid', 'Remaining', 'Status']}>
      {rows.map((row) => (
        <tr key={row.id} className="border-t">
          <td className="p-3 font-semibold">{row.invoice_no || `#${row.id}`}</td>
          <td className="p-3">{row[partyKey] || '-'}</td>
          <td className="p-3">Rs {money(row.total)}</td>
          <td className="p-3 text-green-700">Rs {money(row.paid_amount)}</td>
          <td className="p-3 text-red-700">Rs {money(row.remaining_amount)}</td>
          <td className="p-3">{row.payment_status || row.payment_type || '-'}</td>
        </tr>
      ))}
      {!rows.length && <EmptyRow columns={6} text="No record exists for this date." />}
    </LedgerTable>
  )
}

function PartyTable({ title, rows }) {
  return (
    <LedgerTable title={title} headers={['Party', 'Type', 'Description', 'Debit', 'Credit', 'Balance']}>
      {rows.map((row) => (
        <tr key={row.id} className="border-t">
          <td className="p-3 font-semibold">{row.party_name || '-'}</td>
          <td className="p-3">{row.entry_type || '-'}</td>
          <td className="p-3">{row.description || row.notes || '-'}</td>
          <td className="p-3 text-red-700">Rs {money(row.debit)}</td>
          <td className="p-3 text-green-700">Rs {money(row.credit)}</td>
          <td className="p-3 font-semibold">Rs {money(row.balance_after)}</td>
        </tr>
      ))}
      {!rows.length && <EmptyRow columns={6} text="No ledger entry exists for this date." />}
    </LedgerTable>
  )
}
