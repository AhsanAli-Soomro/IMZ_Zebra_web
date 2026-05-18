'use client'

import { useEffect, useMemo, useState } from 'react'
import InvoicePreviewModal from './InvoicePreviewModal'

const money = (value) => Number(value || 0).toLocaleString()

const formatDate = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString()
}

export default function History() {
  const [activeTab, setActiveTab] = useState('sales')

  const [invoices, setInvoices] = useState([])
  const [purchaseInvoices, setPurchaseInvoices] = useState([])

  const [loading, setLoading] = useState(true)
  const [purchaseLoading, setPurchaseLoading] = useState(true)

  const [error, setError] = useState('')
  const [purchaseError, setPurchaseError] = useState('')

  const [search, setSearch] = useState('')

  const [selectedGroup, setSelectedGroup] = useState(null)
  const [showGroupModal, setShowGroupModal] = useState(false)

  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [invoicePreviewOpen, setInvoicePreviewOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)

  const [company, setCompany] = useState(null)

  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function loadInvoices() {
    try {
      setLoading(true)
      setError('')

      const res = await fetch('/api/invoices', { cache: 'no-store' })
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to load billing history')
      }

      setInvoices(Array.isArray(json.data) ? json.data : [])
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function loadPurchaseInvoices() {
    try {
      setPurchaseLoading(true)
      setPurchaseError('')

      const res = await fetch('/api/purchase-invoices', { cache: 'no-store' })
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to load purchase history')
      }

      setPurchaseInvoices(Array.isArray(json.data) ? json.data : [])
    } catch (err) {
      setPurchaseError(err.message || 'Something went wrong')
    } finally {
      setPurchaseLoading(false)
    }
  }

  async function loadCompany() {
    try {
      const res = await fetch('/api/company-profile')
      const data = await res.json()
      setCompany(data)
    } catch (err) {
      console.error('Company profile load failed', err)
    }
  }

  async function openInvoicePreview(invoiceId) {
    try {
      setDetailLoading(true)
      setMessage('')
      setInvoicePreviewOpen(true)
      setSelectedInvoice(null)

      const url =
        activeTab === 'purchase'
          ? `/api/purchase-invoices/${invoiceId}`
          : `/api/invoices/${invoiceId}`

      const res = await fetch(url, { cache: 'no-store' })
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to load invoice')
      }

      setSelectedInvoice(json.data)
      setPaymentAmount(json.data?.remaining_amount ? String(json.data.remaining_amount) : '')
    } catch (err) {
      setMessage(err.message || 'Failed to load invoice detail')
      setInvoicePreviewOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  async function deleteInvoiceById(invoiceId) {
    const ok = window.confirm('Are you sure you want to delete this invoice?')
    if (!ok) return

    try {
      setMessage('')

      const url =
        activeTab === 'purchase'
          ? `/api/purchase-invoices/${invoiceId}`
          : `/api/invoices/${invoiceId}`

      const res = await fetch(url, { method: 'DELETE' })
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to delete invoice')
      }

      setMessage('Invoice deleted successfully')

      if (activeTab === 'purchase') {
        await loadPurchaseInvoices()
      } else {
        await loadInvoices()
      }

      closeGroupModal()

      if (selectedInvoice && Number(selectedInvoice.id) === Number(invoiceId)) {
        closeInvoicePreview()
      }
    } catch (err) {
      setMessage(err.message || 'Failed to delete invoice')
    }
  }

  async function receivePayment(e) {
    e.preventDefault()

    if (!selectedInvoice?.id) return

    const amount = Number(paymentAmount)
    if (!amount || amount <= 0) {
      setMessage('Please enter a valid payment amount')
      return
    }

    try {
      setPaymentLoading(true)
      setMessage('')

      if (activeTab === 'purchase') {
        setMessage('Purchase payment API abhi add nahi hui.')
        return
      }

      const res = await fetch(`/api/invoices/${selectedInvoice.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          paymentDate: new Date().toISOString().slice(0, 10),
          paymentMethod,
          notes: paymentNotes,
          createdBy: 1,
        }),
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Payment failed')
      }

      setMessage('Payment received successfully')
      setPaymentAmount('')
      setPaymentNotes('')

      await loadInvoices()
      await openInvoicePreview(selectedInvoice.id)
    } catch (err) {
      setMessage(err.message || 'Failed to receive payment')
    } finally {
      setPaymentLoading(false)
    }
  }

  function buildGroup(groupId, groupName, sourceInvoices, type) {
    const rows = Array.isArray(sourceInvoices) ? sourceInvoices : []

    const onlyRows = rows.filter((row) => {
      if (type === 'purchase') {
        return (row.supplier_name || 'Unknown Supplier') === groupName
      }

      if (groupId) {
        return Number(row.customer_id || 0) === Number(groupId || 0)
      }

      return !row.customer_id && (row.customer_name || 'Walk-in Customer') === groupName
    })

    if (!onlyRows.length) return null

    const totalBilled = onlyRows.reduce((sum, row) => sum + Number(row.total || 0), 0)
    const totalPaid = onlyRows.reduce((sum, row) => sum + Number(row.paid_amount || 0), 0)
    const totalRemaining = onlyRows.reduce(
      (sum, row) => sum + Number(row.remaining_amount || 0),
      0
    )

    const sorted = [...onlyRows].sort((a, b) => {
      const da = new Date(a.invoice_date || a.purchase_date || a.created_at || 0).getTime()
      const db = new Date(b.invoice_date || b.purchase_date || b.created_at || 0).getTime()
      if (db !== da) return db - da
      return Number(b.id || 0) - Number(a.id || 0)
    })

    return {
      key:
        type === 'purchase'
          ? `supplier-${groupName || 'unknown'}`
          : groupId
            ? `customer-${groupId}`
            : `walkin-${groupName || 'walkin'}`,
      type,
      group_id: groupId || null,
      group_name:
        type === 'purchase'
          ? sorted[0]?.supplier_name || groupName || 'Unknown Supplier'
          : sorted[0]?.customer_name || groupName || 'Walk-in Customer',
      invoices: sorted,
      totalBilled,
      totalPaid,
      totalRemaining,
      lastInvoiceDate: sorted[0]?.invoice_date || sorted[0]?.purchase_date || sorted[0]?.created_at || null,
    }
  }

  const groupedRows = useMemo(() => {
    const map = new Map()
    const source = activeTab === 'purchase' ? purchaseInvoices : invoices

    for (const row of source) {
      const key =
        activeTab === 'purchase'
          ? `supplier-${row.supplier_name || 'Unknown Supplier'}`
          : row.customer_id
            ? `customer-${row.customer_id}`
            : `walkin-${row.customer_name || 'walkin'}`

      const name =
        activeTab === 'purchase'
          ? row.supplier_name || 'Unknown Supplier'
          : row.customer_name || 'Walk-in Customer'

      const existing = map.get(key)

      if (!existing) {
        map.set(key, {
          key,
          type: activeTab,
          group_id: activeTab === 'purchase' ? null : row.customer_id || null,
          group_name: name,
          invoices: [row],
          totalBilled: Number(row.total || 0),
          totalPaid: Number(row.paid_amount || 0),
          totalRemaining: Number(row.remaining_amount || 0),
          lastInvoiceDate: row.invoice_date || row.purchase_date || row.created_at || null,
        })
      } else {
        existing.invoices.push(row)
        existing.totalBilled += Number(row.total || 0)
        existing.totalPaid += Number(row.paid_amount || 0)
        existing.totalRemaining += Number(row.remaining_amount || 0)

        const currentLast = new Date(existing.lastInvoiceDate || 0).getTime()
        const nextDate = new Date(row.invoice_date || row.purchase_date || row.created_at || 0).getTime()

        if (nextDate > currentLast) {
          existing.lastInvoiceDate = row.invoice_date || row.purchase_date || row.created_at || null
        }
      }
    }

    const rows = Array.from(map.values()).map((group) => ({
      ...group,
      invoices: [...group.invoices].sort((a, b) => {
        const da = new Date(a.invoice_date || a.purchase_date || a.created_at || 0).getTime()
        const db = new Date(b.invoice_date || b.purchase_date || b.created_at || 0).getTime()
        if (db !== da) return db - da
        return Number(b.id || 0) - Number(a.id || 0)
      }),
    }))

    const q = search.trim().toLowerCase()
    const filtered = q
      ? rows.filter((group) => {
          const inName = String(group.group_name || '').toLowerCase().includes(q)
          const inInvoice = group.invoices.some((inv) =>
            String(inv.invoice_no || inv.purchase_no || '').toLowerCase().includes(q)
          )
          return inName || inInvoice
        })
      : rows

    return filtered.sort((a, b) => {
      const da = new Date(a.lastInvoiceDate || 0).getTime()
      const db = new Date(b.lastInvoiceDate || 0).getTime()
      if (db !== da) return db - da
      return String(b.key).localeCompare(String(a.key))
    })
  }, [activeTab, invoices, purchaseInvoices, search])

  function openGroup(group) {
    setSelectedGroup(group)
    setMessage('')
    setShowGroupModal(true)
  }

  function closeGroupModal() {
    setShowGroupModal(false)
    setSelectedGroup(null)
  }

  function closeInvoicePreview() {
    setInvoicePreviewOpen(false)
    setSelectedInvoice(null)
    setPaymentAmount('')
    setPaymentNotes('')
    setMessage('')
  }

  useEffect(() => {
    loadInvoices()
    loadPurchaseInvoices()
    loadCompany()
  }, [])

  useEffect(() => {
    if (!showGroupModal) return

    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeGroupModal()
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [showGroupModal])

  const currentLoading = activeTab === 'purchase' ? purchaseLoading : loading
  const currentError = activeTab === 'purchase' ? purchaseError : error
  const groupLabel = activeTab === 'purchase' ? 'Supplier' : 'Customer'
  const pageTitle = activeTab === 'purchase' ? 'Purchase History' : 'Billing History'
  const summaryTitle =
    activeTab === 'purchase' ? 'Supplier Purchase Summary' : 'Customer Billing Summary'

  const paymentSection =
    selectedInvoice && activeTab === 'sales' ? (
      <div className="bg-white rounded-xl border p-4">
        <h5 className="text-lg font-semibold mb-4">Receive Payment</h5>

        <form onSubmit={receivePayment} className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Amount</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
              <option value="easypaisa">Easypaisa</option>
              <option value="jazzcash">JazzCash</option>
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">Notes</label>
            <textarea
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              rows={3}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <button
            type="submit"
            disabled={paymentLoading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg"
          >
            {paymentLoading ? 'Saving...' : 'Receive Payment'}
          </button>
        </form>
      </div>
    ) : null

  return (
    <>
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-indigo-700">{pageTitle}</h1>
              <p className="text-sm text-gray-500 mt-1">
                {activeTab === 'purchase'
                  ? 'Supplier-wise purchase summary with invoice details.'
                  : 'Customer-wise billing summary with invoice details and payment receiving.'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <div className="flex rounded-lg border overflow-hidden bg-white">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('sales')
                    setSearch('')
                    closeGroupModal()
                  }}
                  className={`px-4 py-2 text-sm font-medium ${
                    activeTab === 'sales'
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Sales
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('purchase')
                    setSearch('')
                    closeGroupModal()
                  }}
                  className={`px-4 py-2 text-sm font-medium ${
                    activeTab === 'purchase'
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Purchase
                </button>
              </div>

              <input
                type="text"
                placeholder={`Search ${groupLabel.toLowerCase()} or invoice no...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full lg:w-80 border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
          </div>
        </div>

        {message && (
          <div className="border border-indigo-200 rounded-md bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
            {message}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h2 className="text-lg font-semibold">{summaryTitle}</h2>
          </div>

          {currentLoading ? (
            <div className="p-6 text-gray-500">
              Loading {activeTab === 'purchase' ? 'purchase' : 'billing'} history...
            </div>
          ) : currentError ? (
            <div className="p-6 text-red-600">{currentError}</div>
          ) : groupedRows.length === 0 ? (
            <div className="p-6 text-gray-500">No history found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-indigo-600 text-white">
                  <tr>
                    <th className="px-4 py-3 text-left">{groupLabel}</th>
                    <th className="px-4 py-3 text-right">Invoices</th>
                    <th className="px-4 py-3 text-right">
                      {activeTab === 'purchase' ? 'Total Purchased' : 'Total Billed'}
                    </th>
                    <th className="px-4 py-3 text-right">Total Paid</th>
                    <th className="px-4 py-3 text-right">Remaining</th>
                    <th className="px-4 py-3 text-left">Last Invoice</th>
                    <th className="px-4 py-3 text-left">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {groupedRows.map((group, idx) => (
                    <tr
                      key={group.key}
                      className={`border-t cursor-pointer hover:bg-indigo-50 ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      }`}
                      onClick={() => openGroup(group)}
                    >
                      <td className="px-4 py-3 font-medium">{group.group_name}</td>
                      <td className="px-4 py-3 text-right">{group.invoices.length}</td>
                      <td className="px-4 py-3 text-right">Rs {money(group.totalBilled)}</td>
                      <td className="px-4 py-3 text-right text-green-700">
                        Rs {money(group.totalPaid)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-semibold ${
                          group.totalRemaining > 0 ? 'text-red-600' : 'text-green-700'
                        }`}
                      >
                        Rs {money(group.totalRemaining)}
                      </td>
                      <td className="px-4 py-3">{formatDate(group.lastInvoiceDate)}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            openGroup(group)
                          }}
                          className="text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          View History
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showGroupModal && selectedGroup && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4"
          onClick={closeGroupModal}
        >
          <div
            className="bg-white w-full max-w-6xl max-h-[92vh] rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b bg-indigo-50">
              <div>
                <h3 className="text-lg font-bold text-gray-800">
                  {selectedGroup.group_name}{' '}
                  {activeTab === 'purchase' ? 'Purchase History' : 'Billing History'}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Total: Rs {money(selectedGroup.totalBilled)} · Paid: Rs{' '}
                  {money(selectedGroup.totalPaid)} · Remaining: Rs{' '}
                  {money(selectedGroup.totalRemaining)}
                </p>
              </div>

              <button
                onClick={closeGroupModal}
                className="text-2xl text-gray-500 hover:text-red-600"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="overflow-auto max-h-[calc(92vh-73px)]">
              <div className="px-5 py-4 border-b bg-white">
                <h4 className="font-semibold">Invoices</h4>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Invoice</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-right">Paid</th>
                      <th className="px-4 py-3 text-right">Remaining</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {selectedGroup.invoices.map((invoice, idx) => (
                      <tr
                        key={invoice.id}
                        className={`border-t ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                      >
                        <td className="px-4 py-3">
                          {formatDate(invoice.invoice_date || invoice.purchase_date)}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {invoice.invoice_no || invoice.purchase_no}
                        </td>
                        <td className="px-4 py-3 text-right">Rs {money(invoice.total)}</td>
                        <td className="px-4 py-3 text-right text-green-700">
                          Rs {money(invoice.paid_amount)}
                        </td>
                        <td className="px-4 py-3 text-right text-red-600">
                          Rs {money(invoice.remaining_amount)}
                        </td>
                        <td className="px-4 py-3 capitalize">
                          {invoice.payment_status || 'unpaid'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-3">
                            <button
                              type="button"
                              onClick={() => openInvoicePreview(invoice.id)}
                              className="text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                              View
                            </button>

                            <button
                              type="button"
                              onClick={() => deleteInvoiceById(invoice.id)}
                              className="text-red-600 hover:text-red-800 font-medium"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {invoicePreviewOpen && (
        <InvoicePreviewModal
          open={invoicePreviewOpen}
          onClose={closeInvoicePreview}
          invoice={detailLoading ? null : selectedInvoice}
          company={company}
          title={selectedInvoice?.invoice_no || selectedInvoice?.purchase_no || 'Invoice Detail'}
          message={message}
          setMessage={setMessage}
          extraContent={paymentSection}
        />
      )}
    </>
  )
}