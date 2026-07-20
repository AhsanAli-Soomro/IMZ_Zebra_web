'use client'

import { useState } from 'react'

export default function SupplierLedgerAdjustmentForm({ supplierId, onSuccess }) {
  const [side, setSide] = useState('credit')
  const [amount, setAmount] = useState('')
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const res = await fetch(`/api/ledger/supplier/${supplierId}/entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          side,
          amount: Number(amount),
          entryDate,
          notes,
          createdBy: 1,
          entryType: side === 'debit' ? 'supplier_adjustment_debit' : 'supplier_adjustment_credit',
          description:
            description ||
            (side === 'debit'
              ? 'Manual supplier debit adjustment'
              : 'Manual supplier credit adjustment'),
        }),
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to save adjustment')
      }

      setAmount('')
      setDescription('')
      setNotes('')
      setMessage('Adjustment saved successfully')

      if (onSuccess) onSuccess()
    } catch (err) {
      setMessage(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border rounded-xl p-4 shadow-sm">
      <h3 className="text-lg font-semibold mb-4">Supplier Ledger Adjustment</h3>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">Entry Type</label>
          <select
            value={side}
            onChange={(e) => setSide(e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            <option value="credit">Credit - Supplier ko dena hai</option>
            <option value="debit">Debit - Supplier ko payment/adjustment</option>
          </select>
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
          <label className="block text-sm mb-1">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="Example: Opening balance / correction"
          />
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
          disabled={loading}
          className="bg-gray-900 hover:bg-black text-white px-4 py-2 rounded"
        >
          {loading ? 'Saving...' : 'Save Adjustment'}
        </button>

        {message && <p className="text-sm text-gray-700">{message}</p>}
      </form>
    </div>
  )
}
