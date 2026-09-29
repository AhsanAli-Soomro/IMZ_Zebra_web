'use client'

import { useEffect, useMemo, useState } from 'react'
import CreatableSelect from 'react-select/creatable'

function today() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function money(value) {
  return Number(value || 0).toLocaleString('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

const newRow = () => ({ accountId: '', amount: '', note: '' })

export default function BankManagement({ type = 'credit' }) {
  const isCredit = type === 'credit'
  const title = `Bank Management — ${isCredit ? 'Credit' : 'Debit'}`
  const transactionType = isCredit ? 'deposit' : 'withdrawal'
  const [date, setDate] = useState(today())
  const [accounts, setAccounts] = useState([])
  const [transactions, setTransactions] = useState([])
  const [rows, setRows] = useState([newRow()])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [menuPortalTarget, setMenuPortalTarget] = useState(null)
  const [creatingBankRow, setCreatingBankRow] = useState(null)
  const [showBankForm, setShowBankForm] = useState(false)
  const [bankSaving, setBankSaving] = useState(false)
  const [bankForm, setBankForm] = useState({
    accountName: '',
    bankName: '',
    accountNumber: '',
    openingBalance: '',
    status: 'Active',
    notes: '',
  })

  async function loadData(selectedDate = date) {
    setLoading(true)
    setError('')
    try {
      const query = encodeURIComponent(selectedDate)
      const [accountsResponse, transactionsResponse] = await Promise.all([
        fetch('/api/bank/accounts', { cache: 'no-store' }),
        fetch(`/api/bank/transactions?dateFrom=${query}&dateTo=${query}`, { cache: 'no-store' }),
      ])
      const accountsJson = await accountsResponse.json()
      const transactionsJson = await transactionsResponse.json()
      if (!accountsResponse.ok || !accountsJson.success) throw new Error(accountsJson.message || 'Bank accounts could not be loaded.')
      if (!transactionsResponse.ok || !transactionsJson.success) throw new Error(transactionsJson.message || 'Bank transactions could not be loaded.')
      setAccounts(accountsJson.data || [])
      setTransactions(transactionsJson.data || [])
    } catch (loadError) {
      setError(loadError.message || 'Bank data could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setMenuPortalTarget(document.body)
  }, [])

  useEffect(() => {
    loadData(date)
  }, [date])

  const accountOptions = useMemo(() => accounts.map((account) => ({
    value: String(account.id),
    label: account?.bank_name ? account?.bank_name : ""
    // label: `${account.account_name}${account.bank_name ? ` — ${account.bank_name}` : ''}${account.account_number ? ` (${account.account_number})` : ''}`,
  })), [accounts])

  const datedTransactions = useMemo(() => transactions.filter((transaction) => transaction.tx_type === transactionType), [transactions, transactionType])
  const dateTotal = useMemo(() => datedTransactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0), [datedTransactions])

  function updateRow(index, field, value) {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row))
  }

  function addRow() {
    setRows((current) => [...current, newRow()])
  }

  function removeRow(index) {
    setRows((current) => current.length === 1 ? [newRow()] : current.filter((_, rowIndex) => rowIndex !== index))
  }

  async function createBankAccount(index, inputValue) {
    const bankName = String(inputValue || '').trim()
    if (!bankName) return

    const existing = accounts.find((account) => (
      String(account.account_name || '').trim().toLowerCase() === bankName.toLowerCase()
      || String(account.bank_name || '').trim().toLowerCase() === bankName.toLowerCase()
    ))
    if (existing) {
      updateRow(index, 'accountId', String(existing.id))
      return
    }

    setCreatingBankRow(index)
    setError('')
    try {
      const response = await fetch('/api/bank/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountName: bankName, bankName, openingBalance: 0 }),
      })
      const json = await response.json()
      if (!response.ok || !json.success) throw new Error(json.message || 'Bank account could not be created.')
      updateRow(index, 'accountId', String(json.data.id))
      await loadData(date)
    } catch (createError) {
      setError(createError.message || 'Bank account could not be created.')
    } finally {
      setCreatingBankRow(null)
    }
  }

  async function saveBankAccount(event) {
    event.preventDefault()
    if (!bankForm.accountName.trim()) {
      setError('Account name is required.')
      return
    }

    setBankSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/bank/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bankForm),
      })
      const json = await response.json()
      if (!response.ok || !json.success) throw new Error(json.message || 'Bank account could not be created.')
      setBankForm({ accountName: '', bankName: '', accountNumber: '', openingBalance: '', status: 'Active', notes: '' })
      setShowBankForm(false)
      setMessage('Bank account successfully add ho gaya.')
      await loadData(date)
    } catch (saveError) {
      setError(saveError.message || 'Bank account could not be created.')
    } finally {
      setBankSaving(false)
    }
  }

  async function saveEntries(event) {
    event.preventDefault()
    const validRows = rows.filter((row) => row.accountId && Number(row.amount) > 0)
    if (!validRows.length) {
      setError('Select at least one bank and enter a valid amount.')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')
    try {
      for (const row of validRows) {
        const response = await fetch('/api/bank/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId: row.accountId,
            txType: transactionType,
            amount: Number(row.amount),
            txDate: date,
            description: isCredit ? 'Bank credit entry' : 'Bank debit entry',
            notes: row.note,
          }),
        })
        const json = await response.json()
        if (!response.ok || !json.success) throw new Error(json.message || 'Bank entry could not be saved.')
      }
      setRows([newRow()])
      setMessage(`${validRows.length} ${isCredit ? 'credit' : 'debit'} ${validRows.length === 1 ? 'entry was' : 'entries were'} saved.`)
      await loadData(date)
    } catch (saveError) {
      setError(saveError.message || 'Bank entries could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <section className={`rounded-2xl border p-5 shadow-sm ${isCredit ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            <p className="mt-1 text-sm text-gray-600">Add multiple bank {isCredit ? 'credits' : 'debits'} for one date, then save them together.</p>
          </div>
          <button type="button" onClick={() => setShowBankForm((current) => !current)} className="rounded-lg bg-green-600 px-5 py-2.5 font-semibold text-white hover:bg-green-700">
            {showBankForm ? 'Cancel' : '+ Add Bank'}
          </button>
        </div>
      </section>

      {message && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">{message}</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

      {showBankForm && <form onSubmit={saveBankAccount} className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900">Add Bank Account</h2>
          <p className="text-sm text-gray-500">Bank ki details enter karke account list mein add karein.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <label><span className="mb-1 block text-sm font-semibold">Account Name *</span><input autoFocus required value={bankForm.accountName} onChange={(event) => setBankForm({ ...bankForm, accountName: event.target.value })} placeholder="e.g. Business Account" className="w-full rounded-lg border border-gray-300 px-3 py-2.5" /></label>
          <label><span className="mb-1 block text-sm font-semibold">Bank Name</span><input value={bankForm.bankName} onChange={(event) => setBankForm({ ...bankForm, bankName: event.target.value })} placeholder="Bank name" className="w-full rounded-lg border border-gray-300 px-3 py-2.5" /></label>
          <label><span className="mb-1 block text-sm font-semibold">Account Number</span><input value={bankForm.accountNumber} onChange={(event) => setBankForm({ ...bankForm, accountNumber: event.target.value })} placeholder="Account number" className="w-full rounded-lg border border-gray-300 px-3 py-2.5" /></label>
          <label><span className="mb-1 block text-sm font-semibold">Opening Balance</span><input type="number" min="0" step="0.01" value={bankForm.openingBalance} onChange={(event) => setBankForm({ ...bankForm, openingBalance: event.target.value })} placeholder="0" className="w-full rounded-lg border border-gray-300 px-3 py-2.5" /></label>
          <label><span className="mb-1 block text-sm font-semibold">Status</span><select value={bankForm.status} onChange={(event) => setBankForm({ ...bankForm, status: event.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5"><option>Active</option><option>Inactive</option></select></label>
          <label><span className="mb-1 block text-sm font-semibold">Notes</span><input value={bankForm.notes} onChange={(event) => setBankForm({ ...bankForm, notes: event.target.value })} placeholder="Optional notes" className="w-full rounded-lg border border-gray-300 px-3 py-2.5" /></label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setShowBankForm(false)} className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 font-semibold text-gray-700">Cancel</button>
          <button type="submit" disabled={bankSaving} className="rounded-lg bg-indigo-600 px-6 py-2.5 font-bold text-white hover:bg-indigo-700 disabled:bg-gray-400">{bankSaving ? 'Saving...' : 'Save Bank'}</button>
        </div>
      </form>}

      <form onSubmit={saveEntries} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{isCredit ? 'Credit' : 'Debit'} Entry</h2>
            <p className="mt-1 text-sm text-gray-500">Select a bank account, enter amount and an optional note for each row.</p>
          </div>
          <label className="w-full md:w-56">
            <span className="mb-1 block text-sm font-bold text-gray-700">Date</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 font-semibold outline-none focus:ring-2 focus:ring-indigo-100" required />
          </label>
        </div>

        <div className="mt-5 overflow-x-auto rounded-xl border border-gray-200">
          <div className="min-w-[780px]">
            <div className="grid grid-cols-[minmax(290px,1.4fr)_minmax(160px,.65fr)_minmax(260px,1fr)_110px] gap-3 bg-gray-900 px-4 py-3 text-sm font-bold text-white">
              <span>Bank Name</span><span>Amount</span><span>Note</span><span>Action</span>
            </div>
            {rows.map((row, index) => (
              <div key={index} className="grid grid-cols-[minmax(290px,1.4fr)_minmax(160px,.65fr)_minmax(260px,1fr)_110px] items-center gap-3 border-t px-4 py-3">
                <CreatableSelect
                  value={accountOptions.find((option) => option.value === String(row.accountId)) || null}
                  options={accountOptions}
                  onChange={(option) => updateRow(index, 'accountId', option?.value || '')}
                  onCreateOption={(inputValue) => createBankAccount(index, inputValue)}
                  isSearchable
                  isClearable
                  placeholder="Type to search a bank..."
                  formatCreateLabel={(inputValue) => `Create bank: ${inputValue}`}
                  isDisabled={creatingBankRow === index}
                  menuPortalTarget={menuPortalTarget}
                  menuPosition="fixed"
                  styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
                />
                <input type="number" min="0.01" step="0.01" value={row.amount} onChange={(event) => updateRow(index, 'amount', event.target.value)} placeholder="Amount" className="rounded-lg border border-gray-300 px-3 py-2.5" />
                <input value={row.note} onChange={(event) => updateRow(index, 'note', event.target.value)} placeholder="Optional note" className="rounded-lg border border-gray-300 px-3 py-2.5" />
                <div className="flex gap-2">
                  {index === rows.length - 1 && <button type="button" onClick={addRow} className="rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">Add Row</button>}
                  {rows.length > 1 && <button type="button" onClick={() => removeRow(index)} className="rounded-lg border border-red-200 px-3 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50">Remove</button>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {!accounts.length && <p className="mt-3 text-sm text-amber-700">Create a bank account first before adding a credit or debit entry.</p>}
        <div className="mt-5 flex justify-end">
          <button disabled={saving || !accounts.length} className={`rounded-xl px-10 py-3 font-extrabold text-white shadow-sm disabled:bg-gray-400 ${isCredit ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
            {saving ? 'Saving...' : `Save ${isCredit ? 'Credit' : 'Debit'} Entries`}
          </button>
        </div>
      </form>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className={`flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${isCredit ? 'bg-green-50' : 'bg-red-50'}`}>
          <div>
            <h2 className="font-bold text-gray-900">{isCredit ? 'Credit' : 'Debit'} List — {date}</h2>
            <p className="text-sm text-gray-500">Only entries from the selected date are shown.</p>
          </div>
          <p className="font-bold text-gray-900">Total: Rs {money(dateTotal)}</p>
        </div>
        <div className="max-h-[480px] overflow-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="sticky top-0 bg-gray-900 text-white"><tr><th className="px-4 py-3 text-left">Bank Name</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-left">Note</th><th className="px-4 py-3 text-right">Balance After</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="4" className="px-4 py-10 text-center text-gray-500">Loading entries...</td></tr>
                : datedTransactions.length ? datedTransactions.map((transaction) => (
                  <tr key={transaction.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-900">{transaction.account_name}{transaction.bank_name ? ` — ${transaction.bank_name}` : ''}</td>
                    <td className="px-4 py-3 text-right font-bold">Rs {money(transaction.amount)}</td>
                    <td className="px-4 py-3 text-gray-600">{transaction.notes || transaction.description || '-'}</td>
                    <td className="px-4 py-3 text-right">Rs {money(transaction.balance_after)}</td>
                  </tr>
                )) : <tr><td colSpan="4" className="px-4 py-10 text-center text-gray-500">No {isCredit ? 'credit' : 'debit'} entries exist for this date.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
