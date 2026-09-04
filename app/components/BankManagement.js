'use client'

import { useEffect, useMemo, useState } from 'react'
import Select from 'react-select'

function money(value) {
  return Number(value || 0).toLocaleString('en-PK')
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

const emptyAccount = {
  accountName: '',
  bankName: '',
  accountNumber: '',
  openingBalance: '',
  status: 'Active',
  notes: '',
}

const emptyTransaction = {
  accountId: '',
  toAccountId: '',
  txType: 'deposit',
  amount: '',
  txDate: today(),
  description: '',
  notes: '',
}

const emptyBulkRow = () => ({ accountId: '', amount: '', note: '' })

const pakistanBankGroups = [
  {
    label: 'Commercial & Specialized Banks',
    banks: [
      'Allied Bank Limited',
      'Askari Bank Limited',
      'Bank Alfalah Limited',
      'Bank Al Habib Limited',
      'Bank Makramah Limited',
      'Bank of Khyber',
      'Bank of Punjab',
      'First Women Bank Limited',
      'Habib Bank Limited (HBL)',
      'Habib Metropolitan Bank Limited',
      'JS Bank Limited',
      'MCB Bank Limited',
      'National Bank of Pakistan',
      'Punjab Provincial Cooperative Bank Limited',
      'Samba Bank Limited',
      'Sindh Bank Limited',
      'Soneri Bank Limited',
      'United Bank Limited (UBL)',
      'Zarai Taraqiati Bank Limited',
    ],
  },
  {
    label: 'Islamic Banks',
    banks: [
      'Al Baraka Bank (Pakistan) Limited',
      'BankIslami Pakistan Limited',
      'Dubai Islamic Bank Pakistan Limited',
      'Faysal Bank Limited',
      'MCB Islamic Bank Limited',
      'Meezan Bank Limited',
    ],
  },
  {
    label: 'Foreign Banks in Pakistan',
    banks: [
      'Bank of China Limited – Pakistan',
      'Citibank N.A. – Pakistan',
      'Deutsche Bank AG – Pakistan',
      'Industrial and Commercial Bank of China – Pakistan',
      'Standard Chartered Bank (Pakistan) Limited',
    ],
  },
  {
    label: 'Digital Banks',
    banks: [
      'Easypaisa Bank Limited',
      'Mashreq Bank Pakistan Limited',
      'Raqami Islamic Digital Bank Limited',
    ],
  },
  {
    label: 'Microfinance Banks',
    banks: [
      'ABHI Microfinance Bank Limited',
      'APNA Microfinance Bank Limited',
      'ASA Microfinance Bank (Pakistan) Limited',
      'Halan Microfinance Bank Limited',
      'HBL Microfinance Bank Limited',
      'Khushhali Microfinance Bank Limited',
      'LOLC Microfinance Bank Limited',
      'Mobilink Microfinance Bank Limited (JazzCash)',
      'NRSP Microfinance Bank Limited',
      'Sindh Microfinance Bank Limited',
      'U Microfinance Bank Limited (UPaisa)',
    ],
  },
]

const searchableBankOptions = [
  ...pakistanBankGroups.map((group) => ({
    label: group.label,
    options: group.banks.map((bank) => ({ value: bank, label: bank })),
  })),
  {
    label: 'Custom Bank',
    options: [{ value: '__new__', label: '+ Add New Bank' }],
  },
]

function findBankOption(value) {
  for (const group of searchableBankOptions) {
    const option = group.options.find((item) => item.value === value)
    if (option) return option
  }
  return null
}

export default function BankManagement() {
  const [accounts, setAccounts] = useState([])
  const [transactions, setTransactions] = useState([])
  const [accountForm, setAccountForm] = useState(emptyAccount)
  const [transactionForm, setTransactionForm] = useState(emptyTransaction)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [customBank, setCustomBank] = useState(false)
  const [bulkType, setBulkType] = useState('deposit')
  const [bulkDate, setBulkDate] = useState(today())
  const [bulkRows, setBulkRows] = useState([emptyBulkRow()])
  const [bulkSaving, setBulkSaving] = useState(false)
  const [menuPortalTarget, setMenuPortalTarget] = useState(null)

  async function loadBankData() {
    const [accountsRes, txRes] = await Promise.all([
      fetch('/api/bank/accounts', { cache: 'no-store' }),
      fetch('/api/bank/transactions', { cache: 'no-store' }),
    ])

    const accountsJson = await accountsRes.json()
    const txJson = await txRes.json()

    if (!accountsRes.ok || !accountsJson.success) {
      throw new Error(accountsJson.message || 'Failed to load bank accounts')
    }

    if (!txRes.ok || !txJson.success) {
      throw new Error(txJson.message || 'Failed to load bank transactions')
    }

    setAccounts(accountsJson.data || [])
    setTransactions(txJson.data || [])
  }

  useEffect(() => {
    setMenuPortalTarget(document.body)
    loadBankData().catch((error) => setMessage(error.message))
  }, [])

  const totalBalance = useMemo(
    () => accounts.reduce((sum, account) => sum + Number(account.current_balance || 0), 0),
    [accounts]
  )

  async function saveAccount(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const res = await fetch('/api/bank/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accountForm),
      })

      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Account save failed')

      setAccountForm(emptyAccount)
      setCustomBank(false)
      await loadBankData()
      setMessage('Bank account saved')
    } catch (error) {
      setMessage(error.message || 'Account save failed')
    } finally {
      setLoading(false)
    }
  }

  async function saveTransaction(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const res = await fetch('/api/bank/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transactionForm),
      })

      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Transaction save failed')

      setTransactionForm(emptyTransaction)
      await loadBankData()
      setMessage('Bank transaction saved')
    } catch (error) {
      setMessage(error.message || 'Transaction save failed')
    } finally {
      setLoading(false)
    }
  }

  const accountOptions = useMemo(() => accounts.map((account) => ({
    value: String(account.id),
    label: `${account.account_name}${account.bank_name ? ` — ${account.bank_name}` : ''}${account.account_number ? ` (${account.account_number})` : ''}`,
    account,
  })), [accounts])

  function updateBulkRow(index, field, value) {
    setBulkRows((current) => current.map((row, rowIndex) => (
      rowIndex === index ? { ...row, [field]: value } : row
    )))
  }

  async function saveBulkTransactions(event) {
    event.preventDefault()
    const validRows = bulkRows.filter((row) => row.accountId && Number(row.amount) > 0)
    if (!validRows.length) {
      setMessage('Select at least one bank and enter a valid amount.')
      return
    }

    setBulkSaving(true)
    setMessage('')
    try {
      for (const row of validRows) {
        const response = await fetch('/api/bank/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId: row.accountId,
            txType: bulkType,
            amount: Number(row.amount),
            txDate: bulkDate,
            description: bulkType === 'deposit' ? 'Bulk bank credit' : 'Bulk bank debit',
            notes: row.note,
          }),
        })
        const json = await response.json()
        if (!response.ok || !json.success) throw new Error(json.message || 'Bank transaction could not be saved.')
      }
      setBulkRows([emptyBulkRow()])
      await loadBankData()
      setMessage(`${validRows.length} bank ${bulkType === 'deposit' ? 'credit' : 'debit'} entries saved successfully.`)
    } catch (error) {
      setMessage(error.message || 'Bank entries could not be saved.')
    } finally {
      setBulkSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Bank Management</h1>
        <p className="text-sm text-gray-500">
          Bank accounts, deposits, withdrawals, transfers, balances and transaction history.
        </p>
      </div>

      {message && (
        <div className="rounded-lg border bg-gray-50 px-4 py-3 text-sm text-gray-700">
          {message}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-blue-50 p-4">
          <p className="text-sm text-blue-700">Bank Balance</p>
          <p className="text-2xl font-bold text-blue-900">Rs {money(totalBalance)}</p>
        </div>
        <div className="rounded-xl border bg-gray-50 p-4">
          <p className="text-sm text-gray-700">Accounts</p>
          <p className="text-2xl font-bold">{accounts.length}</p>
        </div>
        <div className="rounded-xl border bg-gray-50 p-4">
          <p className="text-sm text-gray-700">Transactions</p>
          <p className="text-2xl font-bold">{transactions.length}</p>
        </div>
      </div>

      <form onSubmit={saveBulkTransactions} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Bank Credit / Debit Entry</h2>
            <p className="mt-1 text-sm text-gray-500">Image jaisa date-wise multiple bank entries add karein.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setBulkType('deposit')} className={`rounded-lg px-5 py-2.5 text-sm font-bold ${bulkType === 'deposit' ? 'bg-green-600 text-white' : 'border text-gray-700'}`}>Credit</button>
            <button type="button" onClick={() => setBulkType('withdrawal')} className={`rounded-lg px-5 py-2.5 text-sm font-bold ${bulkType === 'withdrawal' ? 'bg-red-600 text-white' : 'border text-gray-700'}`}>Debit</button>
            <label className="min-w-44"><span className="mb-1 block text-xs font-semibold text-gray-600">Date</span><input type="date" value={bulkDate} onChange={(event) => setBulkDate(event.target.value)} className="w-full rounded-lg border px-3 py-2" required /></label>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto rounded-xl border border-gray-200">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[minmax(280px,1.4fr)_minmax(180px,.7fr)_minmax(260px,1fr)_100px] gap-3 bg-gray-900 px-4 py-3 text-sm font-bold text-white">
              <span>Bank Name</span><span>Amount</span><span>Note</span><span>Action</span>
            </div>
            {bulkRows.map((row, index) => (
              <div key={index} className="grid grid-cols-[minmax(280px,1.4fr)_minmax(180px,.7fr)_minmax(260px,1fr)_100px] items-center gap-3 border-t px-4 py-3">
                <Select value={accountOptions.find((option) => option.value === String(row.accountId)) || null} options={accountOptions} onChange={(option) => updateBulkRow(index, 'accountId', option?.value || '')} isSearchable isClearable placeholder="Type bank name to search..." noOptionsMessage={() => 'Bank account not found'} className="text-sm" menuPortalTarget={menuPortalTarget} menuPosition="fixed" styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }), menu: (base) => ({ ...base, zIndex: 9999 }) }} />
                <input type="number" min="0.01" step="0.01" value={row.amount} onChange={(event) => updateBulkRow(index, 'amount', event.target.value)} placeholder="Amount" className="rounded-lg border px-3 py-2.5" />
                <input value={row.note} onChange={(event) => updateBulkRow(index, 'note', event.target.value)} placeholder="Anything / optional note" className="rounded-lg border px-3 py-2.5" />
                {index === bulkRows.length - 1 ? <button type="button" onClick={() => setBulkRows((current) => [...current, emptyBulkRow()])} className="rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-bold text-white">Add Row</button> : <button type="button" onClick={() => setBulkRows((current) => current.filter((_, rowIndex) => rowIndex !== index))} className="rounded-lg px-3 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50">Remove</button>}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-5 flex justify-end"><button disabled={bulkSaving || !accounts.length} className={`rounded-xl px-10 py-3 text-base font-extrabold text-white shadow-sm disabled:bg-gray-400 ${bulkType === 'deposit' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>{bulkSaving ? 'Saving...' : `Save ${bulkType === 'deposit' ? 'Credit' : 'Debit'} Entries`}</button></div>
      </form>

      <div className="grid xl:grid-cols-2 gap-5">
        <form onSubmit={saveAccount} className="rounded-xl border bg-white p-4 space-y-3">
          <h2 className="font-semibold">Bank Account</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <input
              value={accountForm.accountName}
              onChange={(e) => setAccountForm({ ...accountForm, accountName: e.target.value })}
              placeholder="Account name"
              required
              className="border rounded px-3 py-2 text-sm"
            />
            <div className="space-y-2">
              <Select
                options={searchableBankOptions}
                value={
                  customBank
                    ? findBankOption('__new__')
                    : findBankOption(accountForm.bankName)
                }
                onChange={(selected) => {
                  const isNew = selected?.value === '__new__'
                  setCustomBank(isNew)
                  setAccountForm({
                    ...accountForm,
                    bankName: isNew ? '' : selected?.value || '',
                  })
                }}
                isSearchable
                isClearable
                placeholder="Type to search for a bank..."
                noOptionsMessage={() => 'No matching bank found'}
                className="text-sm"
                classNamePrefix="bank-select"
                menuPortalTarget={menuPortalTarget}
                menuPosition="fixed"
                styles={{
                  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                  menu: (base) => ({ ...base, zIndex: 9999 }),
                }}
              />
              {customBank && (
                <input
                  value={accountForm.bankName}
                  onChange={(e) => setAccountForm({ ...accountForm, bankName: e.target.value })}
                  placeholder="New bank name"
                  required
                  className="border rounded px-3 py-2 text-sm w-full"
                />
              )}
            </div>
            <input
              value={accountForm.accountNumber}
              onChange={(e) => setAccountForm({ ...accountForm, accountNumber: e.target.value })}
              placeholder="Account number"
              className="border rounded px-3 py-2 text-sm"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={accountForm.openingBalance}
              onChange={(e) => setAccountForm({ ...accountForm, openingBalance: e.target.value })}
              placeholder="Opening balance"
              className="border rounded px-3 py-2 text-sm"
            />
          </div>
          <textarea
            value={accountForm.notes}
            onChange={(e) => setAccountForm({ ...accountForm, notes: e.target.value })}
            placeholder="Notes"
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <button
            disabled={loading}
            className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-400"
          >
            Save Account
          </button>
        </form>

        <form onSubmit={saveTransaction} className="rounded-xl border bg-white p-4 space-y-3">
          <h2 className="font-semibold">Bank Transaction</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <select
              value={transactionForm.accountId}
              onChange={(e) => setTransactionForm({ ...transactionForm, accountId: e.target.value })}
              required
              className="border rounded px-3 py-2 text-sm"
            >
              <option value="">Select account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.account_name} - Rs {money(account.current_balance)}
                </option>
              ))}
            </select>
            <select
              value={transactionForm.txType}
              onChange={(e) => setTransactionForm({ ...transactionForm, txType: e.target.value })}
              className="border rounded px-3 py-2 text-sm"
            >
              <option value="deposit">Deposit</option>
              <option value="withdrawal">Withdrawal</option>
              <option value="transfer">Transfer</option>
            </select>
            {transactionForm.txType === 'transfer' && (
              <select
                value={transactionForm.toAccountId}
                onChange={(e) => setTransactionForm({ ...transactionForm, toAccountId: e.target.value })}
                required
                className="border rounded px-3 py-2 text-sm"
              >
                <option value="">Transfer to</option>
                {accounts
                  .filter((account) => String(account.id) !== String(transactionForm.accountId))
                  .map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.account_name}
                    </option>
                  ))}
              </select>
            )}
            <input
              type="number"
              min="0"
              step="0.01"
              value={transactionForm.amount}
              onChange={(e) => setTransactionForm({ ...transactionForm, amount: e.target.value })}
              placeholder="Amount"
              required
              className="border rounded px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={transactionForm.txDate}
              onChange={(e) => setTransactionForm({ ...transactionForm, txDate: e.target.value })}
              className="border rounded px-3 py-2 text-sm"
            />
            <input
              value={transactionForm.description}
              onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })}
              placeholder="Description"
              className="border rounded px-3 py-2 text-sm"
            />
          </div>
          <textarea
            value={transactionForm.notes}
            onChange={(e) => setTransactionForm({ ...transactionForm, notes: e.target.value })}
            placeholder="Notes"
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <button
            disabled={loading}
            className="rounded bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-400"
          >
            Save Transaction
          </button>
        </form>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 font-semibold">Transaction History</h2>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Account</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-right">Balance</th>
                <th className="px-3 py-2 text-left">Description</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-t">
                  <td className="px-3 py-2">{tx.tx_date}</td>
                  <td className="px-3 py-2">{tx.account_name}</td>
                  <td className="px-3 py-2">{tx.tx_type.replaceAll('_', ' ')}</td>
                  <td className="px-3 py-2 text-right">Rs {money(tx.amount)}</td>
                  <td className="px-3 py-2 text-right">Rs {money(tx.balance_after)}</td>
                  <td className="px-3 py-2">{tx.description || '-'}</td>
                </tr>
              ))}
              {!transactions.length && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                    No bank transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
