'use client'

import { useEffect, useMemo, useState } from 'react'
import SupplierPaymentForm from './SupplierPaymentForm'
import SupplierLedgerAdjustmentForm from './SupplierLedgerAdjustmentForm'
import InvoicePreviewModal from './InvoicePreviewModal'

function formatAmount(value) {
  return Number(value || 0).toLocaleString('en-PK')
}

function getEntryLabel(type) {
  const labels = {
    purchase_credit: 'Purchase / Payable',
    supplier_payment: 'Supplier Payment',
    supplier_adjustment_debit: 'Manual Debit',
    supplier_adjustment_credit: 'Manual Credit',
  }

  return labels[type] || type || '-'
}

function getBalanceLabel(balance) {
  const amount = Number(balance || 0)

  if (amount > 0) return `Supplier ko dena hai: ${formatAmount(amount)}`
  if (amount < 0) return `Supplier se lena hai: ${formatAmount(Math.abs(amount))}`

  return 'Balance clear'
}

function getBalanceColor(balance) {
  const amount = Number(balance || 0)

  if (amount > 0) return 'text-orange-700'
  if (amount < 0) return 'text-blue-700'

  return 'text-green-700'
}

export default function SupplierKhata({ supplierId }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [activeTab, setActiveTab] = useState('pay')
  const [visibleCount, setVisibleCount] = useState(10)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false)
  const [invoiceLoading, setInvoiceLoading] = useState(false)

  async function loadLedger() {
    if (!supplierId) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/ledger/supplier/${supplierId}`, { cache: 'no-store' })
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to load supplier ledger')
      }

      setData(json.data)
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLedger()
  }, [supplierId])

  useEffect(() => {
    setVisibleCount(10)
  }, [search, typeFilter, dateFrom, dateTo, supplierId])

  const summary = data?.summary || {}
  const supplier = data?.supplier || {}
  const entries = data?.entries || []

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const keyword = search.toLowerCase()

      const matchSearch =
        !keyword ||
        String(entry.entry_date || '').toLowerCase().includes(keyword) ||
        String(entry.entry_type || '').toLowerCase().includes(keyword) ||
        String(entry.reference_type || '').toLowerCase().includes(keyword) ||
        String(entry.reference_id || '').toLowerCase().includes(keyword) ||
        String(entry.description || '').toLowerCase().includes(keyword) ||
        String(entry.notes || '').toLowerCase().includes(keyword)

      const matchType =
        typeFilter === 'all' ||
        entry.entry_type === typeFilter ||
        (typeFilter === 'debit' && Number(entry.debit || 0) > 0) ||
        (typeFilter === 'credit' && Number(entry.credit || 0) > 0)

      const entryDate = String(entry.entry_date || '')
      const matchFrom = !dateFrom || entryDate >= dateFrom
      const matchTo = !dateTo || entryDate <= dateTo

      return matchSearch && matchType && matchFrom && matchTo
    })
  }, [entries, search, typeFilter, dateFrom, dateTo])

  const visibleEntries = filteredEntries.slice(0, visibleCount)

  async function openInvoice(invoiceId, printAfterOpen = false) {
    try {
      setInvoiceLoading(true)

      const res = await fetch(`/api/purchase-invoices/${invoiceId}`, { cache: 'no-store' })
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to load purchase invoice')
      }

      setSelectedInvoice(json.data)
      setInvoiceModalOpen(true)

      if (printAfterOpen) {
        setTimeout(() => window.print(), 250)
      }
    } catch (err) {
      alert(err.message || 'Purchase invoice load failed')
    } finally {
      setInvoiceLoading(false)
    }
  }

  function handleLedgerScroll(e) {
    const el = e.currentTarget
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 20

    if (nearBottom && visibleCount < filteredEntries.length) {
      setVisibleCount((prev) => Math.min(prev + 10, filteredEntries.length))
    }
  }

  if (!supplierId) {
    return <div className="p-4">Supplier not selected.</div>
  }

  if (loading) {
    return <div className="p-4">Loading supplier khata...</div>
  }

  if (error) {
    return <div className="p-4 text-red-600">{error}</div>
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">
              {supplier.company_name || supplier.name || supplier.supplier_name || 'Supplier'}
            </h2>

            <div className="text-sm text-gray-600 mt-2 space-y-1">
              <p>Contact: {supplier.name || '-'}</p>
              <p>Phone: {supplier.phone || '-'}</p>
              <p>City: {supplier.city || '-'}</p>
              <p>Address: {supplier.address || '-'}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="h-fit rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Print Statement
            </button>

            <div className="bg-gray-50 border rounded-xl px-4 py-3 min-w-[260px]">
              <p className="text-sm text-gray-500">Current Status</p>
              <p className={`text-lg font-bold ${getBalanceColor(summary.balance)}`}>
                {getBalanceLabel(summary.balance)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <p className="text-sm text-gray-600">Total Credit</p>
          <p className="text-xs text-gray-500">Purchases / Payable</p>
          <p className="text-2xl font-bold text-orange-700 mt-2">
            {formatAmount(summary.total_credit)}
          </p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm text-gray-600">Total Debit</p>
          <p className="text-xs text-gray-500">Paid / Adjustment</p>
          <p className="text-2xl font-bold text-green-700 mt-2">
            {formatAmount(summary.total_debit)}
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-gray-600">Net Balance</p>
          <p className="text-xs text-gray-500">Credit - Debit</p>
          <p className="text-xl font-bold text-blue-700 mt-2">
            {formatAmount(summary.balance)}
          </p>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-600">Total Entries</p>
          <p className="text-xs text-gray-500">Ledger Records</p>
          <p className="text-2xl font-bold text-gray-800 mt-2">
            {entries.length}
          </p>
        </div>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="flex border-b">
          <button
            type="button"
            onClick={() => setActiveTab('pay')}
            className={`px-5 py-3 text-sm font-semibold border-b-2 ${activeTab === 'pay'
              ? 'border-green-600 text-green-700 bg-green-50'
              : 'border-transparent text-gray-600 hover:bg-gray-50'
              }`}
          >
            Pay Supplier
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('adjustment')}
            className={`px-5 py-3 text-sm font-semibold border-b-2 ${activeTab === 'adjustment'
              ? 'border-gray-900 text-gray-900 bg-gray-50'
              : 'border-transparent text-gray-600 hover:bg-gray-50'
              }`}
          >
            Ledger Adjustment
          </button>
        </div>

        <div className="p-4">
          {activeTab === 'pay' && (
            <SupplierPaymentForm
              supplierId={supplierId}
              supplierName={supplier.name}
              onSuccess={loadLedger}
            />
          )}

          {activeTab === 'adjustment' && (
            <SupplierLedgerAdjustmentForm supplierId={supplierId} onSuccess={loadLedger} />
          )}
        </div>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Supplier Ledger</h3>
              <p className="text-sm text-gray-500">
                Supplier payable, payments, running balance and references
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search date, ref, notes..."
                className="border rounded px-3 py-2 text-sm"
              />

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

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="border rounded px-3 py-2 text-sm"
              >
                <option value="all">All Entries</option>
                <option value="credit">Credit Only</option>
                <option value="debit">Debit Only</option>
                <option value="purchase_credit">Purchases</option>
                <option value="supplier_payment">Payments</option>
                <option value="supplier_adjustment_credit">Manual Credit</option>
                <option value="supplier_adjustment_debit">Manual Debit</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-auto max-h-[500px]" onScroll={handleLedgerScroll}>
          <table className="w-full text-sm">
            <thead className="bg-gray-100 sticky top-0 z-10">
              <tr>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Entry</th>
                <th className="text-left px-4 py-3">Reference</th>
                <th className="text-left px-4 py-3">Description</th>
                <th className="text-right px-4 py-3">Debit</th>
                <th className="text-right px-4 py-3">Credit</th>
                <th className="text-right px-4 py-3">Balance</th>
                <th className="text-left px-4 py-3">Notes</th>
                <th className="text-center px-4 py-3">Action</th>
              </tr>
            </thead>

            <tbody>
              {visibleEntries.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-4 py-8 text-center text-gray-500">
                    No supplier ledger entries found.
                  </td>
                </tr>
              ) : (
                visibleEntries.map((entry) => {
                  const debit = Number(entry.debit || 0)
                  const credit = Number(entry.credit || 0)
                  const balance = Number(entry.balance_after || 0)

                  return (
                    <tr key={entry.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">{entry.entry_date}</td>

                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{getEntryLabel(entry.entry_type)}</span>
                          {entry.entry_type === 'purchase_credit' && (
                            <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs inline-block w-fit">
                              Purchase
                            </span>
                          )}
                          {entry.entry_type === 'supplier_payment' && (
                            <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs inline-block w-fit">
                              Payment
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-gray-600">
                        {entry.reference_type
                          ? `${entry.reference_type} #${entry.reference_id || '-'}`
                          : '-'}
                      </td>

                      <td className="px-4 py-3">{entry.description || '-'}</td>

                      <td className="px-4 py-3 text-right text-green-700 font-medium">
                        {debit > 0 ? formatAmount(debit) : '-'}
                      </td>

                      <td className="px-4 py-3 text-right text-orange-700 font-medium">
                        {credit > 0 ? formatAmount(credit) : '-'}
                      </td>

                      <td className={`px-4 py-3 text-right font-bold ${getBalanceColor(balance)}`}>
                        <div>{formatAmount(balance)}</div>
                        <div className="text-[11px] font-medium">
                          {balance > 0 ? 'Payable' : balance < 0 ? 'Receivable' : 'Clear'}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-gray-600">{entry.notes || '-'}</td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          {entry.reference_type === 'purchase_invoice' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => openInvoice(entry.reference_id)}
                                disabled={invoiceLoading}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1 rounded"
                              >
                                View
                              </button>

                              <button
                                type="button"
                                onClick={() => openInvoice(entry.reference_id, true)}
                                disabled={invoiceLoading}
                                className="bg-gray-900 hover:bg-black text-white text-xs px-3 py-1 rounded"
                              >
                                Print
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {filteredEntries.length > 10 && (
          <div className="px-4 py-3 border-t bg-gray-50 text-sm text-gray-600 flex items-center justify-between">
            <span>
              Showing {visibleEntries.length} entries out of {filteredEntries.length}
            </span>

            <span className="text-xs text-gray-500">
              {visibleEntries.length < filteredEntries.length
                ? 'Scroll down to load more'
                : 'All entries loaded'}
            </span>
          </div>
        )}
      </div>

      <InvoicePreviewModal
        open={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        invoice={selectedInvoice}
      />
    </div>
  )
}
