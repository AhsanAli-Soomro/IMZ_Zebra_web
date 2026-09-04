'use client'

import { useEffect, useMemo, useState } from 'react'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function money(value) {
  return Number(value || 0).toLocaleString('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function entryLabel(type) {
  const labels = {
    invoice: 'Sale Invoice',
    sale_credit: 'Sale Invoice',
    payment_received: 'Payment Received',
    customer_debit: 'Debit Adjustment',
    customer_credit: 'Credit Adjustment',
    purchase_credit: 'Purchase Invoice',
    supplier_payment: 'Payment Paid',
    supplier_debit: 'Debit Adjustment',
    supplier_credit: 'Credit Adjustment',
  }
  return labels[type] || String(type || 'Entry').replaceAll('_', ' ')
}

export default function PartyLedger({ type }) {
  const isCustomer = type === 'customer'
  const partyLabel = isCustomer ? 'Customer' : 'Supplier'
  const [parties, setParties] = useState([])
  const [banks, setBanks] = useState([])
  const [partyId, setPartyId] = useState('')
  const [ledger, setLedger] = useState(null)
  const [amount, setAmount] = useState('')
  const [entryDate, setEntryDate] = useState(today())
  const [paymentAccount, setPaymentAccount] = useState('cash')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    kind: 'all',
    search: '',
  })

  async function loadInitialData() {
    setLoading(true)
    setMessage({ type: '', text: '' })

    try {
      const [partyRes, bankRes] = await Promise.all([
        fetch(isCustomer ? '/api/customers' : '/api/suppliers', { cache: 'no-store' }),
        fetch('/api/bank/accounts', { cache: 'no-store' }),
      ])
      const [partyJson, bankJson] = await Promise.all([partyRes.json(), bankRes.json()])

      if (!partyRes.ok || !partyJson.success) {
        throw new Error(partyJson.message || `${partyLabel} list could not be loaded.`)
      }
      if (!bankRes.ok || !bankJson.success) {
        throw new Error(bankJson.message || 'Bank list could not be loaded.')
      }

      const activeParties = (partyJson.data || []).filter(
        (party) => String(party.status || '').toLowerCase() !== 'inactive'
      )
      setParties(activeParties)
      setBanks((bankJson.data || []).filter((bank) => bank.status === 'Active'))
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Data could not be loaded.' })
    } finally {
      setLoading(false)
    }
  }

  async function loadLedger(selectedId = partyId) {
    setLoading(true)
    try {
      const url = selectedId
        ? `/api/ledger/${type}/${selectedId}`
        : `/api/ledger/history?type=${type}`
      const res = await fetch(url, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Ledger could not be loaded.')
      setLedger(json.data)
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Ledger could not be loaded.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInitialData()
    setPartyId('')
  }, [type])

  useEffect(() => {
    setLedger(null)
    setFilters({ from: '', to: '', kind: 'all', search: '' })
    loadLedger(partyId)
  }, [partyId, type])

  const filteredEntries = useMemo(() => {
    const query = filters.search.trim().toLowerCase()

    return [...(ledger?.entries || [])]
      .filter((entry) => {
        if (filters.from && entry.entry_date < filters.from) return false
        if (filters.to && entry.entry_date > filters.to) return false
        if (filters.kind === 'payment' && !entry.entry_type?.includes('payment')) return false
        if (filters.kind === 'invoice' && entry.reference_type !== (isCustomer ? 'bill' : 'purchase_invoice')) {
          return false
        }
        if (filters.kind === 'adjustment' && !entry.entry_type?.includes('adjustment')) {
          return false
        }
        if (
          query &&
          !`${entry.description || ''} ${entry.notes || ''} ${entry.source_of_payment || ''}`
            .toLowerCase()
            .includes(query)
        ) {
          return false
        }
        return true
      })
      .reverse()
  }, [ledger, filters, isCustomer])

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setMessage({ type: '', text: '' })

    try {
      const safeAmount = Number(amount || 0)
      if (!partyId) throw new Error(`Select a ${partyLabel.toLowerCase()}.`)
      if (safeAmount <= 0) throw new Error('Enter a valid amount.')

      const selectedBank =
        paymentAccount === 'cash'
          ? null
          : banks.find((bank) => String(bank.id) === String(paymentAccount))

      if (paymentAccount !== 'cash' && !selectedBank) {
        throw new Error('Select a valid bank account.')
      }

      const sourceOfPayment = selectedBank
        ? `${selectedBank.account_name}${selectedBank.bank_name ? ` - ${selectedBank.bank_name}` : ''}`
        : 'Cash'

      const res = await fetch(`/api/ledger/${type}/${partyId}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: safeAmount,
          entryDate,
          paymentMethod: selectedBank ? 'bank' : 'cash',
          sourceOfPayment,
          bankAccountId: selectedBank?.id || null,
          notes,
          createdBy: 1,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Entry could not be saved.')

      setAmount('')
      setNotes('')
      setMessage({
        type: 'success',
        text: isCustomer
          ? 'Customer payment receive ho gayi.'
          : 'Supplier payment successfully add ho gayi.',
      })
      await Promise.all([loadLedger(partyId), loadInitialData()])
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Entry could not be saved.' })
    } finally {
      setSaving(false)
    }
  }

  const selectedParty = parties.find((party) => String(party.id) === String(partyId))
  const summary = ledger?.summary || {}

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{partyLabel} Ledger</h1>
        <p className="mt-1 text-sm text-gray-600">
          {isCustomer
            ? 'Manage customer payments received and complete account history.'
            : 'Manage supplier payments and complete account history.'}
        </p>
      </div>

      {message.text && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            message.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-green-200 bg-green-50 text-green-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <form onSubmit={handleSubmit} className="h-fit rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">
            {isCustomer ? 'Receive Cash / Payment' : 'Pay Cash / Payment'}
          </h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">{partyLabel} Name</label>
              <select
                value={partyId}
                onChange={(event) => setPartyId(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                required
              >
                <option value="">All {partyLabel}s — Complete History</option>
                {parties.map((party) => (
                  <option key={party.id} value={party.id}>
                    {party.name || party.company_name || `${partyLabel} ${party.id}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                {isCustomer ? 'Cash Received' : 'Amount Paid'}
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="0"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Cash / Bank / Easypaisa</label>
              <select
                value={paymentAccount}
                onChange={(event) => setPaymentAccount(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="cash">Cash</option>
                {banks.map((bank) => (
                  <option key={bank.id} value={bank.id}>
                    {bank.account_name}
                    {bank.bank_name ? ` — ${bank.bank_name}` : ''}
                    {` (Rs ${money(bank.current_balance)})`}
                  </option>
                ))}
              </select>
              {!banks.length && (
                <p className="mt-1 text-xs text-gray-500">
                  Added Bank/Easypaisa accounts Bank Management se nazar aayenge.
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Date</label>
              <input
                type="date"
                value={entryDate}
                onChange={(event) => setEntryDate(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Notes</label>
              <textarea
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="Optional details"
              />
            </div>

            <button
              type="submit"
              disabled={saving || loading}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? 'Saving...' : isCustomer ? 'Receive Payment' : 'Pay Supplier'}
            </button>
          </div>
        </form>

        <div className="min-w-0 space-y-4">
          {/* <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-500">{isCustomer ? 'Total Sales/Debit' : 'Total Paid'}</p>
              <p className="mt-1 text-xl font-bold">Rs {money(summary.total_debit)}</p>
            </div>
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-500">{isCustomer ? 'Total Received' : 'Total Purchases'}</p>
              <p className="mt-1 text-xl font-bold">Rs {money(summary.total_credit)}</p>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm">
              <p className="text-xs text-indigo-600">Current Balance</p>
              <p className="mt-1 text-xl font-bold text-indigo-700">Rs {money(summary.balance)}</p>
            </div>
          </div> */}

          <div className="rounded-xl border bg-white shadow-sm">
            <div className="border-b p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">
                  {selectedParty
                    ? `${selectedParty.name || selectedParty.company_name} History`
                    : `All ${partyLabel}s History`}
                </h2>
                <button
                  type="button"
                  onClick={() => loadLedger(partyId)}
                  disabled={loading}
                  className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  Refresh
                </button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <input
                  type="date"
                  value={filters.from}
                  onChange={(event) => setFilters({ ...filters, from: event.target.value })}
                  className="rounded-lg border px-3 py-2 text-sm"
                  title="From date"
                />
                <input
                  type="date"
                  value={filters.to}
                  onChange={(event) => setFilters({ ...filters, to: event.target.value })}
                  className="rounded-lg border px-3 py-2 text-sm"
                  title="To date"
                />
                <select
                  value={filters.kind}
                  onChange={(event) => setFilters({ ...filters, kind: event.target.value })}
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="all">All Entries</option>
                  <option value="payment">Payments</option>
                  <option value="invoice">Invoices</option>
                  <option value="adjustment">Adjustments</option>
                </select>
                <input
                  value={filters.search}
                  onChange={(event) => setFilters({ ...filters, search: event.target.value })}
                  className="rounded-lg border px-3 py-2 text-sm"
                  placeholder="Search notes/source"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Cash / Bank</th>
                    <th className="p-3 text-right">Debit</th>
                    <th className="p-3 text-right">Credit</th>
                    <th className="p-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr><td colSpan={7} className="p-8 text-center text-gray-500">Loading...</td></tr>
                  ) : !filteredEntries.length ? (
                    <tr><td colSpan={7} className="p-8 text-center text-gray-500">Koi ledger entry nahi mili.</td></tr>
                  ) : (
                    filteredEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap p-3">{entry.entry_date}</td>
                        <td className="p-3 font-medium">{entryLabel(entry.entry_type)}</td>
                        <td className="p-3">
                          {!partyId && (
                            <div className="font-semibold text-indigo-700">{entry.party_name}</div>
                          )}
                          <div>{entry.description || '-'}</div>
                          {entry.notes && <div className="text-xs text-gray-500">{entry.notes}</div>}
                        </td>
                        <td className="p-3">{entry.source_of_payment || entry.payment_method || '-'}</td>
                        <td className="p-3 text-right">{entry.debit ? `Rs ${money(entry.debit)}` : '-'}</td>
                        <td className="p-3 text-right">{entry.credit ? `Rs ${money(entry.credit)}` : '-'}</td>
                        <td className="p-3 text-right font-semibold">Rs {money(entry.balance_after)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
