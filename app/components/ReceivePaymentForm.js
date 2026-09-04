'use client'

import { useEffect, useMemo, useState } from 'react'

function formatAmount(value) {
  return Number(value || 0).toLocaleString('en-PK')
}

export default function ReceivePaymentForm({ customerId, onSuccess }) {
  const [paymentMode, setPaymentMode] = useState('invoice') // invoice | general
  const [invoices, setInvoices] = useState([])
  const [invoiceId, setInvoiceId] = useState('')
  const [amount, setAmount] = useState('')
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10))
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [sourceOfPayment, setSourceOfPayment] = useState('Customer')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [message, setMessage] = useState('')

  async function loadInvoices() {
    if (!customerId) return

    setLoadingInvoices(true)

    try {
      const res = await fetch(
        `/api/invoices?customerId=${customerId}&limit=100`
      )
      const json = await res.json()

      if (res.ok && json.success) {
        const unpaidInvoices = (json.data || []).filter((inv) =>
          ['unpaid', 'partial'].includes(inv.payment_status)
        )

        setInvoices(unpaidInvoices)

        if (unpaidInvoices.length && !invoiceId) {
          setInvoiceId(String(unpaidInvoices[0].id))
          setAmount(String(unpaidInvoices[0].remaining_amount || 0))
        }
      }
    } finally {
      setLoadingInvoices(false)
    }
  }

  useEffect(() => {
    loadInvoices()
  }, [customerId])

  const selectedInvoice = useMemo(() => {
    return invoices.find((inv) => String(inv.id) === String(invoiceId)) || null
  }, [invoices, invoiceId])

  function handleInvoiceChange(value) {
    setInvoiceId(value)

    const inv = invoices.find((item) => String(item.id) === String(value))
    if (inv) {
      setAmount(String(inv.remaining_amount || 0))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const paymentAmount = Number(amount || 0)

      if (paymentAmount <= 0) {
        throw new Error('Valid amount required')
      }

      if (paymentMode === 'invoice') {
        if (!invoiceId) {
          throw new Error('Please select invoice')
        }

        if (selectedInvoice && paymentAmount > Number(selectedInvoice.remaining_amount || 0)) {
          throw new Error('Amount cannot exceed the invoice balance.')
        }
      }

      const url =
        paymentMode === 'invoice'
          ? `/api/invoices/${invoiceId}/payment`
          : `/api/ledger/customer/${customerId}/payment`

      const body =
        paymentMode === 'invoice'
          ? {
              amount: paymentAmount,
              paymentDate: entryDate,
              paymentMethod,
              sourceOfPayment,
              notes,
              createdBy: 1,
            }
          : {
              amount: paymentAmount,
              entryDate,
              paymentMethod,
              sourceOfPayment,
              notes,
              createdBy: 1,
            }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Payment failed')
      }

      setAmount('')
      setNotes('')
      setMessage(
        paymentMode === 'invoice'
          ? 'Invoice payment received successfully'
          : 'General payment received successfully'
      )

      await loadInvoices()
      if (onSuccess) onSuccess()
    } catch (error) {
      setMessage(error.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border rounded-xl p-4 shadow-sm">
      <h3 className="text-lg font-semibold mb-4">Receive Payment</h3>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">Payment Against</label>
          <select
            value={paymentMode}
            onChange={(e) => {
              setPaymentMode(e.target.value)
              setMessage('')
              if (e.target.value === 'general') {
                setInvoiceId('')
                setAmount('')
              } else if (invoices.length) {
                handleInvoiceChange(String(invoices[0].id))
              }
            }}
            className="w-full border rounded px-3 py-2"
          >
            <option value="invoice">Specific Invoice</option>
            <option value="general">General / Advance Payment</option>
          </select>
        </div>

        {paymentMode === 'invoice' && (
          <div>
            <label className="block text-sm mb-1">Select Invoice</label>
            <select
              value={invoiceId}
              onChange={(e) => handleInvoiceChange(e.target.value)}
              className="w-full border rounded px-3 py-2"
              disabled={loadingInvoices}
              required
            >
              {invoices.length === 0 ? (
                <option value="">No unpaid invoice found</option>
              ) : (
                invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoice_no} | Total: {formatAmount(inv.total)} | Remaining:{' '}
                    {formatAmount(inv.remaining_amount)}
                  </option>
                ))
              )}
            </select>

            {selectedInvoice && (
              <p className="text-xs text-gray-500 mt-1">
                Remaining Amount: {formatAmount(selectedInvoice.remaining_amount)}
              </p>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm mb-1">Amount</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full border rounded px-3 py-2"
            required
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Date</label>
          <input
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            className="w-full border rounded px-3 py-2"
            required
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Payment Method</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            <option value="cash">Cash</option>
            <option value="bank">Bank</option>
            <option value="easypaisa">Easypaisa</option>
            <option value="jazzcash">JazzCash</option>
            <option value="cheque">Cheque</option>
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1">Source of Payment</label>
          <select
            value={sourceOfPayment}
            onChange={(e) => setSourceOfPayment(e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            <option value="Customer">Customer</option>
            <option value="Bank">Bank</option>
            <option value="Cash Counter">Cash Counter</option>
            <option value="Owner Investment">Owner Investment</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border rounded px-3 py-2"
            rows={3}
          />
        </div>

        <button
          type="submit"
          disabled={loading || loadingInvoices || (paymentMode === 'invoice' && !invoiceId)}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded"
        >
          {loading ? 'Saving...' : 'Receive Payment'}
        </button>

        {message && <p className="text-sm text-gray-700">{message}</p>}
      </form>
    </div>
  )
}
