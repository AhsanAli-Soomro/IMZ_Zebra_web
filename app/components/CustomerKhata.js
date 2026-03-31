'use client'

import { useEffect, useState } from 'react'
import ReceivePaymentForm from './ReceivePaymentForm'

export default function CustomerKhata({ customerId }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [debitAmount, setDebitAmount] = useState('')
  const [debitNotes, setDebitNotes] = useState('')
  const [savingDebit, setSavingDebit] = useState(false)

  async function loadLedger() {
    if (!customerId) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/ledger/customer/${customerId}`)
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to load ledger')
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
  }, [customerId])

  async function addManualDebit(e) {
    e.preventDefault()
    setSavingDebit(true)

    try {
      const res = await fetch(`/api/ledger/customer/${customerId}/entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          side: 'debit',
          amount: Number(debitAmount),
          entryDate: new Date().toISOString().slice(0, 10),
          notes: debitNotes,
          createdBy: 1,
          entryType: 'adjustment_debit',
          description: 'Manual debit adjustment',
        }),
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to add entry')
      }

      setDebitAmount('')
      setDebitNotes('')
      await loadLedger()
    } catch (err) {
      alert(err.message || 'Failed to add debit')
    } finally {
      setSavingDebit(false)
    }
  }

  if (!customerId) {
    return <div className="p-4">Customer not selected.</div>
  }

  if (loading) {
    return <div className="p-4">Loading customer khata...</div>
  }

  if (error) {
    return <div className="p-4 text-red-600">{error}</div>
  }

  const summary = data?.summary || {}
  const customer = data?.customer || {}
  const entries = data?.entries || []

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-xl p-5 shadow-sm">
        <h2 className="text-2xl font-bold mb-2">
          {customer.full_name || customer.name || customer.customer_name || 'Customer'}
        </h2>
        <div className="text-sm text-gray-600 space-y-1">
          <p>Phone: {customer.phone || '-'}</p>
          <p>City: {customer.city || '-'}</p>
          <p>Address: {customer.address || '-'}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-gray-600">Total Sale / Udhaar (Debit)</p>
          <p className="text-2xl font-bold text-red-700">{summary.total_debit || 0}</p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm text-gray-600">Total Received /Cash (Credit)</p>
          <p className="text-2xl font-bold text-green-700">{summary.total_credit || 0}</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-gray-600">Remaining / Lena Hai (Net Balance)</p>
          <p className="text-2xl font-bold text-blue-700">{summary.balance || 0}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <ReceivePaymentForm customerId={customerId} onSuccess={loadLedger} />

        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Manual Debit Entry</h3>

          <form onSubmit={addManualDebit} className="space-y-3">
            <div>
              <label className="block text-sm mb-1">Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={debitAmount}
                onChange={(e) => setDebitAmount(e.target.value)}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Notes</label>
              <textarea
                value={debitNotes}
                onChange={(e) => setDebitNotes(e.target.value)}
                className="w-full border rounded px-3 py-2"
                rows={3}
              />
            </div>

            <button
              type="submit"
              disabled={savingDebit}
              className="bg-gray-900 hover:bg-black text-white px-4 py-2 rounded"
            >
              {savingDebit ? 'Saving...' : 'Add Debit'}
            </button>
          </form>
        </div>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">Ledger Entries</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Description</th>
                <th className="text-right px-4 py-3">Debit</th>
                <th className="text-right px-4 py-3">Credit</th>
                <th className="text-right px-4 py-3">Balance</th>
                <th className="text-left px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-6 text-center text-gray-500">
                    No ledger entries found.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="border-t">
                    <td className="px-4 py-3">{entry.entry_date}</td>
                    <td className="px-4 py-3">{entry.entry_type}</td>
                    <td className="px-4 py-3">{entry.description || '-'}</td>
                    <td className="px-4 py-3 text-right">{entry.debit}</td>
                    <td className="px-4 py-3 text-right">{entry.credit}</td>
                    <td className="px-4 py-3 text-right font-medium">{entry.balance_after}</td>
                    <td className="px-4 py-3">{entry.notes || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}