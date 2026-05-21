'use client'

import { useEffect, useMemo, useState } from 'react'

function formatAmount(value) {
  return Number(value || 0).toLocaleString('en-PK')
}

function getTxLabel(type) {
  if (type === 'in') return 'Credit / Cash In'
  if (type === 'out') return 'Debit / Cash Out'
  return type || '-'
}

function getCategoryLabel(value) {
  const labels = {
    sale_invoice_payment: 'Sale Invoice Payment',
    customer_payment: 'Customer Payment',
    expense: 'Expense',
    supplier_payment: 'Supplier Payment',
    salary: 'Salary',
    purchase_payment: 'Purchase Payment',
  }

  return labels[value] || value || '-'
}

export default function CashInformation() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [txType, setTxType] = useState('')
  const [category, setCategory] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [sourceOfPayment, setSourceOfPayment] = useState('')
  const [referenceType, setReferenceType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')

  async function loadCash() {
    setLoading(true)
    setError('')

    try {
      const qs = new URLSearchParams()

      if (search) qs.set('search', search)
      if (txType) qs.set('txType', txType)
      if (category) qs.set('category', category)
      if (paymentMethod) qs.set('paymentMethod', paymentMethod)
      if (sourceOfPayment) qs.set('sourceOfPayment', sourceOfPayment)
      if (referenceType) qs.set('referenceType', referenceType)
      if (dateFrom) qs.set('dateFrom', dateFrom)
      if (dateTo) qs.set('dateTo', dateTo)
      if (minAmount) qs.set('minAmount', minAmount)
      if (maxAmount) qs.set('maxAmount', maxAmount)

      qs.set('limit', '1000')

      const res = await fetch(`/api/cash-transactions?${qs.toString()}`)
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to load cash information')
      }

      setRows(json.data || [])
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCash()
    }, 300)

    return () => clearTimeout(timer)
  }, [
    search,
    txType,
    category,
    paymentMethod,
    sourceOfPayment,
    referenceType,
    dateFrom,
    dateTo,
    minAmount,
    maxAmount,
  ])

  const options = useMemo(() => {
    return {
      categories: [...new Set(rows.map((r) => r.category).filter(Boolean))],
      methods: [...new Set(rows.map((r) => r.payment_method).filter(Boolean))],
      sources: [...new Set(rows.map((r) => r.source_of_payment).filter(Boolean))],
      references: [...new Set(rows.map((r) => r.reference_type).filter(Boolean))],
    }
  }, [rows])

  const totalCredit = rows.reduce(
    (sum, row) => sum + (row.tx_type === 'in' ? Number(row.amount || 0) : 0),
    0
  )

  const totalDebit = rows.reduce(
    (sum, row) => sum + (row.tx_type === 'out' ? Number(row.amount || 0) : 0),
    0
  )

  const balance = totalCredit - totalDebit

  function clearFilters() {
    setSearch('')
    setTxType('')
    setCategory('')
    setPaymentMethod('')
    setSourceOfPayment('')
    setReferenceType('')
    setDateFrom('')
    setDateTo('')
    setMinAmount('')
    setMaxAmount('')
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Cash Information</h1>
        <p className="text-sm text-gray-500">
          Complete store cash book: cash in, cash out, sources, methods, references and balance.
        </p>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-green-50 p-4">
          <p className="text-sm text-green-700">Total Credit / Cash In</p>
          <p className="text-2xl font-bold text-green-800">{formatAmount(totalCredit)}</p>
        </div>

        <div className="rounded-xl border bg-red-50 p-4">
          <p className="text-sm text-red-700">Total Debit / Cash Out</p>
          <p className="text-2xl font-bold text-red-800">{formatAmount(totalDebit)}</p>
        </div>

        <div className="rounded-xl border bg-blue-50 p-4">
          <p className="text-sm text-blue-700">Cash Balance</p>
          <p className="text-2xl font-bold text-blue-800">{formatAmount(balance)}</p>
        </div>

        <div className="rounded-xl border bg-gray-50 p-4">
          <p className="text-sm text-gray-700">Transactions</p>
          <p className="text-2xl font-bold text-gray-800">{rows.length}</p>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-4 space-y-3">
        <div className="grid md:grid-cols-4 gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search source, method, notes..."
            className="border rounded px-3 py-2 text-sm"
          />

          <select
            value={txType}
            onChange={(e) => setTxType(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">All Debit/Credit</option>
            <option value="in">Credit / Cash In</option>
            <option value="out">Debit / Cash Out</option>
          </select>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">All Categories</option>
            {options.categories.map((item) => (
              <option key={item} value={item}>
                {getCategoryLabel(item)}
              </option>
            ))}
          </select>

          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">All Payment Methods</option>
            {options.methods.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={sourceOfPayment}
            onChange={(e) => setSourceOfPayment(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">All Sources</option>
            {options.sources.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={referenceType}
            onChange={(e) => setReferenceType(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">All References</option>
            {options.references.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />

          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />

          <input
            type="number"
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value)}
            placeholder="Min amount"
            className="border rounded px-3 py-2 text-sm"
          />

          <input
            type="number"
            value={maxAmount}
            onChange={(e) => setMaxAmount(e.target.value)}
            placeholder="Max amount"
            className="border rounded px-3 py-2 text-sm"
          />

          <button
            type="button"
            onClick={clearFilters}
            className="border rounded px-3 py-2 text-sm hover:bg-gray-50"
          >
            Clear Filters
          </button>
        </div>

        {loading && <div className="p-4 text-sm text-gray-500">Loading cash information...</div>}
        {error && <div className="p-4 text-sm text-red-600">{error}</div>}

        {!loading && !error && (
          <div className="border rounded-xl overflow-hidden">
            <div className="overflow-auto max-h-[560px]">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-left px-4 py-3">Debit/Credit</th>
                    <th className="text-left px-4 py-3">Source</th>
                    <th className="text-left px-4 py-3">Payment Method</th>
                    <th className="text-left px-4 py-3">Category</th>
                    <th className="text-left px-4 py-3">Reference</th>
                    <th className="text-right px-4 py-3">Amount</th>
                    <th className="text-left px-4 py-3">Description</th>
                    <th className="text-left px-4 py-3">Notes</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="text-center text-gray-500 px-4 py-8">
                        No cash transactions found.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.id} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">{row.tx_date}</td>

                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              row.tx_type === 'in'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {getTxLabel(row.tx_type)}
                          </span>
                        </td>

                        <td className="px-4 py-3">{row.source_of_payment || '-'}</td>
                        <td className="px-4 py-3">{row.payment_method || '-'}</td>
                        <td className="px-4 py-3">{getCategoryLabel(row.category)}</td>

                        <td className="px-4 py-3">
                          {row.reference_type
                            ? `${row.reference_type} #${row.reference_id || '-'}`
                            : '-'}
                        </td>

                        <td className="px-4 py-3 text-right font-semibold">
                          {formatAmount(row.amount)}
                        </td>

                        <td className="px-4 py-3">{row.description || '-'}</td>
                        <td className="px-4 py-3">{row.notes || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}