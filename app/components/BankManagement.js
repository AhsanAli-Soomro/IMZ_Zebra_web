'use client'

import { useEffect, useMemo, useState } from 'react'

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

export default function BankManagement() {
  const [accounts, setAccounts] = useState([])
  const [transactions, setTransactions] = useState([])
  const [accountForm, setAccountForm] = useState(emptyAccount)
  const [transactionForm, setTransactionForm] = useState(emptyTransaction)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

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
            <input
              value={accountForm.bankName}
              onChange={(e) => setAccountForm({ ...accountForm, bankName: e.target.value })}
              placeholder="Bank name"
              className="border rounded px-3 py-2 text-sm"
            />
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
