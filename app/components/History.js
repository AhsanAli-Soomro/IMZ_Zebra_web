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
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [showCustomerModal, setShowCustomerModal] = useState(false)

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

      const res = await fetch(`/api/invoices/${invoiceId}`, { cache: 'no-store' })
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

      if (selectedCustomer) {
        const updatedCustomer = buildCustomerGroup(
          selectedCustomer.customer_id,
          selectedCustomer.customer_name,
          invoices
        )
        if (updatedCustomer) setSelectedCustomer(updatedCustomer)
      }
    } catch (err) {
      setMessage(err.message || 'Failed to receive payment')
    } finally {
      setPaymentLoading(false)
    }
  }

  function buildCustomerGroup(customerId, customerName, sourceInvoices) {
    const rows = Array.isArray(sourceInvoices) ? sourceInvoices : []

    const onlyCustomer = rows.filter((row) => {
      if (customerId) {
        return Number(row.customer_id || 0) === Number(customerId || 0)
      }
      return !row.customer_id && (row.customer_name || 'Walk-in Customer') === customerName
    })

    if (!onlyCustomer.length) return null

    const totalBilled = onlyCustomer.reduce((sum, row) => sum + Number(row.total || 0), 0)
    const totalPaid = onlyCustomer.reduce((sum, row) => sum + Number(row.paid_amount || 0), 0)
    const totalRemaining = onlyCustomer.reduce(
      (sum, row) => sum + Number(row.remaining_amount || 0),
      0
    )

    const sorted = [...onlyCustomer].sort((a, b) => {
      const da = new Date(a.invoice_date || a.created_at || 0).getTime()
      const db = new Date(b.invoice_date || b.created_at || 0).getTime()
      if (db !== da) return db - da
      return Number(b.id || 0) - Number(a.id || 0)
    })

    return {
      key: customerId ? `customer-${customerId}` : `walkin-${customerName || 'walkin'}`,
      customer_id: customerId || null,
      customer_name: sorted[0]?.customer_name || customerName || 'Walk-in Customer',
      invoices: sorted,
      totalBilled,
      totalPaid,
      totalRemaining,
      lastInvoiceDate: sorted[0]?.invoice_date || sorted[0]?.created_at || null,
    }
  }

  const groupedCustomers = useMemo(() => {
    const map = new Map()

    for (const row of invoices) {
      const key = row.customer_id
        ? `customer-${row.customer_id}`
        : `walkin-${row.customer_name || 'walkin'}`

      const existing = map.get(key)

      if (!existing) {
        map.set(key, {
          key,
          customer_id: row.customer_id || null,
          customer_name: row.customer_name || 'Walk-in Customer',
          invoices: [row],
          totalBilled: Number(row.total || 0),
          totalPaid: Number(row.paid_amount || 0),
          totalRemaining: Number(row.remaining_amount || 0),
          lastInvoiceDate: row.invoice_date || row.created_at || null,
        })
      } else {
        existing.invoices.push(row)
        existing.totalBilled += Number(row.total || 0)
        existing.totalPaid += Number(row.paid_amount || 0)
        existing.totalRemaining += Number(row.remaining_amount || 0)

        const currentLast = new Date(existing.lastInvoiceDate || 0).getTime()
        const nextDate = new Date(row.invoice_date || row.created_at || 0).getTime()

        if (nextDate > currentLast) {
          existing.lastInvoiceDate = row.invoice_date || row.created_at || null
        }
      }
    }

    const rows = Array.from(map.values()).map((cust) => ({
      ...cust,
      invoices: [...cust.invoices].sort((a, b) => {
        const da = new Date(a.invoice_date || a.created_at || 0).getTime()
        const db = new Date(b.invoice_date || b.created_at || 0).getTime()
        if (db !== da) return db - da
        return Number(b.id || 0) - Number(a.id || 0)
      }),
    }))

    const q = search.trim().toLowerCase()
    const filtered = q
      ? rows.filter((cust) => {
          const inName = String(cust.customer_name || '').toLowerCase().includes(q)
          const inInvoice = cust.invoices.some((inv) =>
            String(inv.invoice_no || '').toLowerCase().includes(q)
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
  }, [invoices, search])

  function openCustomer(customer) {
    setSelectedCustomer(customer)
    setMessage('')
    setShowCustomerModal(true)
  }

  function closeCustomerModal() {
    setShowCustomerModal(false)
    setSelectedCustomer(null)
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
    loadCompany()
  }, [])

  useEffect(() => {
    if (!showCustomerModal) return

    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeCustomerModal()
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [showCustomerModal])

  const paymentSection = selectedInvoice ? (
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
              <h1 className="text-2xl font-bold text-indigo-700">Billing History</h1>
              <p className="text-sm text-gray-500 mt-1">
                Customer-wise billing summary with invoice details and payment receiving.
              </p>
            </div>

            <div className="w-full lg:w-80">
              <input
                type="text"
                placeholder="Search customer or invoice no..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h2 className="text-lg font-semibold">Customer Billing Summary</h2>
          </div>

          {loading ? (
            <div className="p-6 text-gray-500">Loading billing history...</div>
          ) : error ? (
            <div className="p-6 text-red-600">{error}</div>
          ) : groupedCustomers.length === 0 ? (
            <div className="p-6 text-gray-500">No billing history found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-indigo-600 text-white">
                  <tr>
                    <th className="px-4 py-3 text-left">Customer</th>
                    <th className="px-4 py-3 text-right">Invoices</th>
                    <th className="px-4 py-3 text-right">Total Billed</th>
                    <th className="px-4 py-3 text-right">Total Paid</th>
                    <th className="px-4 py-3 text-right">Remaining</th>
                    <th className="px-4 py-3 text-left">Last Invoice</th>
                    <th className="px-4 py-3 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedCustomers.map((customer, idx) => (
                    <tr
                      key={customer.key}
                      className={`border-t cursor-pointer hover:bg-indigo-50 ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      }`}
                      onClick={() => openCustomer(customer)}
                    >
                      <td className="px-4 py-3 font-medium">{customer.customer_name}</td>
                      <td className="px-4 py-3 text-right">{customer.invoices.length}</td>
                      <td className="px-4 py-3 text-right">Rs {money(customer.totalBilled)}</td>
                      <td className="px-4 py-3 text-right text-green-700">
                        Rs {money(customer.totalPaid)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-semibold ${
                          customer.totalRemaining > 0 ? 'text-red-600' : 'text-green-700'
                        }`}
                      >
                        Rs {money(customer.totalRemaining)}
                      </td>
                      <td className="px-4 py-3">{formatDate(customer.lastInvoiceDate)}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            openCustomer(customer)
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

      {showCustomerModal && selectedCustomer && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4"
          onClick={closeCustomerModal}
        >
          <div
            className="bg-white w-full max-w-6xl max-h-[92vh] rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b bg-indigo-50">
              <div>
                <h3 className="text-lg font-bold text-gray-800">
                  {selectedCustomer.customer_name} Billing History
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Total Billed: Rs {money(selectedCustomer.totalBilled)} · Paid: Rs{' '}
                  {money(selectedCustomer.totalPaid)} · Remaining: Rs{' '}
                  {money(selectedCustomer.totalRemaining)}
                </p>
              </div>

              <button
                onClick={closeCustomerModal}
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
                    {selectedCustomer.invoices.map((invoice, idx) => (
                      <tr
                        key={invoice.id}
                        className={`border-t ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                      >
                        <td className="px-4 py-3">{formatDate(invoice.invoice_date)}</td>
                        <td className="px-4 py-3 font-medium">{invoice.invoice_no}</td>
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
                          <button
                            type="button"
                            onClick={() => openInvoicePreview(invoice.id)}
                            className="text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            View
                          </button>
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
          title={selectedInvoice?.invoice_no || 'Invoice Detail'}
          message={message}
          setMessage={setMessage}
          extraContent={paymentSection}
        />
      )}
    </>
  )
}