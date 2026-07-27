'use client'

import { useEffect, useState } from 'react'

function today() {
  return new Date().toISOString().slice(0, 10)
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

export default function DailyLedger() {
  const [date, setDate] = useState(today())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
  }, [date])

  const summary = data?.summary || {}
  const cards = [
    ['Cash in Hand', summary.cash_in_hand, 'bg-blue-50 text-blue-800'],
    ['Credit / Cash In', summary.day_credit, 'bg-green-50 text-green-800'],
    ['Debit / Cash Out', summary.day_debit, 'bg-red-50 text-red-800'],
    ['Net Cash Today', summary.day_net_cash, 'bg-indigo-50 text-indigo-800'],
    ['Total Sales', summary.sales_total, 'bg-emerald-50 text-emerald-800'],
    ['Total Purchases', summary.purchase_total, 'bg-orange-50 text-orange-800'],
  ]

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Daily Ledger</h1>
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
            className="border rounded-lg px-3 py-2 bg-white"
          />
        </div>
      </div>

      {error && <div className="border border-red-200 bg-red-50 text-red-700 rounded-lg p-3">{error}</div>}
      {loading && <div className="border bg-gray-50 rounded-lg p-3 text-gray-600">Ledger loading...</div>}

      <div className="grid sm:grid-cols-2 xl:grid-cols-6 gap-3">
        {cards.map(([label, value, color]) => (
          <div key={label} className={`rounded-xl border p-4 ${color}`}>
            <p className="text-xs font-semibold">{label}</p>
            <p className="text-xl font-bold mt-1">Rs {money(value)}</p>
          </div>
        ))}
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
        {!data?.cashTransactions?.length && <EmptyRow columns={6} text="Is date par cash transaction nahi hai." />}
      </LedgerTable>

      <InvoiceTable title="Sales & Customers" rows={data?.sales || []} partyKey="customer_name" partyLabel="Customer" />
      <InvoiceTable title="Purchases & Suppliers / Sellers" rows={data?.purchases || []} partyKey="supplier_name" partyLabel="Supplier / Seller" />
      <PartyTable title="Customer Ledger Entries" rows={data?.customerEntries || []} />
      <PartyTable title="Supplier / Seller Ledger Entries" rows={data?.supplierEntries || []} />
    </div>
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
      {!rows.length && <EmptyRow columns={6} text="Is date par koi record nahi hai." />}
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
      {!rows.length && <EmptyRow columns={6} text="Is date par ledger entry nahi hai." />}
    </LedgerTable>
  )
}
