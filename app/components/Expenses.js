'use client'

import { useEffect, useMemo, useState } from 'react'

function today() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function emptyRow(date = today()) {
  return { expense_date: date, amount: '', notes: '' }
}

function money(value) {
  return Number(value || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })
}

export default function ExpensesPage() {
  const [filterDate, setFilterDate] = useState(today())
  const [rows, setRows] = useState([emptyRow()])
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [editingExpense, setEditingExpense] = useState(null)
  const [savingEdit, setSavingEdit] = useState(false)

  async function fetchExpenses(date = filterDate) {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/expenses?date=${encodeURIComponent(date)}`, { cache: 'no-store' })
      const json = await response.json()
      if (!response.ok || !json.success) throw new Error(json.message || 'Expenses could not be loaded.')
      setExpenses(json.data || [])
    } catch (loadError) {
      setError(loadError.message || 'Expenses could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExpenses(filterDate)
  }, [filterDate])

  const total = useMemo(() => expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0), [expenses])

  function updateRow(index, field, value) {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row))
    setMessage('')
    setError('')
  }

  function addRow(index) {
    const row = rows[index]
    if (!row.expense_date || !(Number(row.amount) > 0)) {
      setError('Date aur valid amount enter karein.')
      return
    }
    if (index === rows.length - 1) setRows((current) => [...current, emptyRow(row.expense_date)])
  }

  function removeRow(index) {
    setRows((current) => current.length === 1 ? [emptyRow(filterDate)] : current.filter((_, rowIndex) => rowIndex !== index))
  }

  async function saveExpenses(event) {
    event.preventDefault()
    const validRows = rows.filter((row) => row.expense_date && Number(row.amount) > 0)
    if (!validRows.length) {
      setError('Kam az kam ek complete expense row add karein.')
      return
    }
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: validRows }),
      })
      const json = await response.json()
      if (!response.ok || !json.success) throw new Error(json.message || 'Expenses could not be saved.')
      setRows([emptyRow(filterDate)])
      setMessage(`${json.count || validRows.length} expense entries successfully save ho gayin.`)
      await fetchExpenses(filterDate)
    } catch (saveError) {
      setError(saveError.message || 'Expenses could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  async function saveExpenseEdit(event) {
    event.preventDefault()
    if (!editingExpense?.expense_date || !(Number(editingExpense.amount) > 0)) {
      setError('Date aur valid amount enter karein.')
      return
    }
    setSavingEdit(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/expenses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editingExpense,
          category: editingExpense.category || '',
          payment_method: editingExpense.payment_method || '',
        }),
      })
      const json = await response.json()
      if (!response.ok || !json.success) throw new Error(json.message || 'Expense could not be updated.')
      setEditingExpense(null)
      setMessage('Expense successfully update ho gaya.')
      await fetchExpenses(filterDate)
    } catch (saveError) {
      setError(saveError.message || 'Expense could not be updated.')
    } finally {
      setSavingEdit(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><h1 className="text-2xl font-bold text-gray-900">Expense Entry</h1><p className="mt-1 text-sm text-gray-500">Daily expenses ek saath add karein aur date ke hisaab se dekhein.</p></div>
          <label className="w-full sm:w-64"><span className="mb-1 block text-sm font-bold text-gray-700">Filter Date</span><input type="date" value={filterDate} onChange={(event) => setFilterDate(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 font-semibold outline-none focus:border-indigo-500" /></label>
        </div>
      </section>

      {message && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">{message}</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

      <form onSubmit={saveExpenses} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto"><div className="min-w-[760px]">
          <div className="grid grid-cols-[180px_180px_minmax(260px,1fr)_120px] gap-3 bg-gray-900 px-5 py-3 text-sm font-bold text-white"><span>Date</span><span>Amount</span><span>Note</span><span>Action</span></div>
          {rows.map((row, index) => <div key={index} className="grid grid-cols-[180px_180px_minmax(260px,1fr)_120px] items-center gap-3 border-t px-5 py-3">
            <input type="date" required value={row.expense_date} onChange={(event) => updateRow(index, 'expense_date', event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2.5" />
            <input type="number" min="0.01" step="0.01" value={row.amount} onChange={(event) => updateRow(index, 'amount', event.target.value)} placeholder="Amount" className="rounded-lg border border-gray-300 px-3 py-2.5" />
            <input value={row.notes} onChange={(event) => updateRow(index, 'notes', event.target.value)} placeholder="Optional note" className="rounded-lg border border-gray-300 px-3 py-2.5" />
            {index === rows.length - 1 ? <button type="button" onClick={() => addRow(index)} className="rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">Add Row</button> : <button type="button" onClick={() => removeRow(index)} className="rounded-lg px-3 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50">Remove</button>}
          </div>)}
        </div></div>
        <div className="flex justify-center border-t bg-gray-50 p-5"><button type="submit" disabled={saving} className="min-w-56 rounded-xl bg-green-600 px-8 py-3 font-extrabold tracking-wider text-white hover:bg-green-700 disabled:bg-gray-400">{saving ? 'SAVING...' : 'SAVE EXPENSES'}</button></div>
      </form>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between bg-indigo-50 px-5 py-4"><div><h2 className="font-bold text-gray-900">Expenses — {filterDate}</h2><p className="text-sm text-gray-500">Selected date ki tamam expense entries</p></div><p className="font-bold text-gray-900">Total: Rs {money(total)}</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead className="bg-gray-900 text-white"><tr><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-left">Note</th><th className="px-4 py-3 text-left">Action</th></tr></thead>
          <tbody>{loading ? <tr><td colSpan="4" className="px-4 py-10 text-center text-gray-500">Loading expenses...</td></tr> : expenses.length ? expenses.map((expense) => <tr key={expense.id} className="border-t hover:bg-gray-50"><td className="px-4 py-3 font-semibold">{expense.expense_date}</td><td className="px-4 py-3 text-right font-bold">Rs {money(expense.amount)}</td><td className="px-4 py-3 text-gray-600">{expense.notes || '-'}</td><td className="px-4 py-3"><button type="button" onClick={() => setEditingExpense({ ...expense })} className="rounded-lg bg-amber-500 px-3 py-1.5 font-semibold text-white hover:bg-amber-600">Edit</button></td></tr>) : <tr><td colSpan="4" className="px-4 py-10 text-center text-gray-500">Is date par koi expense entry nahi hai.</td></tr>}</tbody>
        </table></div>
      </section>

      {editingExpense && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <form onSubmit={saveExpenseEdit} className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
          <h2 className="text-xl font-bold text-gray-900">Edit Expense</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label><span className="mb-1 block text-sm font-bold text-gray-700">Date</span><input type="date" required value={editingExpense.expense_date || ''} onChange={(event) => setEditingExpense({ ...editingExpense, expense_date: event.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5" /></label>
            <label><span className="mb-1 block text-sm font-bold text-gray-700">Amount</span><input type="number" min="0.01" step="0.01" required value={editingExpense.amount || ''} onChange={(event) => setEditingExpense({ ...editingExpense, amount: event.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5" /></label>
            <label className="sm:col-span-2"><span className="mb-1 block text-sm font-bold text-gray-700">Note</span><input autoFocus value={editingExpense.notes || ''} onChange={(event) => setEditingExpense({ ...editingExpense, notes: event.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5" placeholder="Optional note" /></label>
          </div>
          <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setEditingExpense(null)} disabled={savingEdit} className="rounded-lg border border-gray-300 px-4 py-2 font-semibold">Cancel</button><button type="submit" disabled={savingEdit} className="rounded-lg bg-indigo-600 px-5 py-2 font-semibold text-white disabled:bg-gray-400">{savingEdit ? 'Saving...' : 'Save Changes'}</button></div>
        </form>
      </div>}
    </div>
  )
}
