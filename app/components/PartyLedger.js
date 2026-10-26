'use client'

import { useEffect, useMemo, useState } from 'react'
import Select from 'react-select'
import InvoicePreviewModal from './InvoicePreviewModal'

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
    balance_adjustment_debit: 'Balance Adjustment (Dr)',
    balance_adjustment_credit: 'Balance Adjustment (Cr)',
    bulk_balance_debit: 'Opening Balance (Dr)',
    bulk_balance_credit: 'Opening Balance (Cr)',
    purchase_credit: 'Purchase Invoice',
    supplier_payment: 'Payment Paid',
    supplier_debit: 'Debit Adjustment',
    supplier_credit: 'Credit Adjustment',
    supplier_adjustment_debit: 'Debit Adjustment',
    supplier_adjustment_credit: 'Credit Adjustment',
    supplier_bulk_balance_debit: 'Opening Balance (Dr)',
    supplier_bulk_balance_credit: 'Opening Balance (Cr)',
  }
  return labels[type] || String(type || 'Entry').replaceAll('_', ' ')
}

export default function PartyLedger({ type, initialPartyId = '' }) {
  const isCustomer = type === 'customer'
  const partyLabel = isCustomer ? 'Customer' : 'Supplier'

  const [parties, setParties] = useState([])
  const [banks, setBanks] = useState([])
  const [partyId, setPartyId] = useState(initialPartyId ? String(initialPartyId) : '')
  const [ledger, setLedger] = useState(null)
  const [company, setCompany] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [menuPortalTarget, setMenuPortalTarget] = useState(null)

  // Filters
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    kind: 'all',
    search: '',
  })

  // Balance Edit Modal State
  const [balanceModalOpen, setBalanceModalOpen] = useState(false)
  const [balanceMode, setBalanceMode] = useState('direct_balance') // 'direct_balance' | 'adjustment'
  const [targetBalance, setTargetBalance] = useState('')
  const [adjustSide, setAdjustSide] = useState('debit')
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustDate, setAdjustDate] = useState(today())
  const [adjustNotes, setAdjustNotes] = useState('')
  const [savingBalance, setSavingBalance] = useState(false)

  // Payment Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(today())
  const [paymentAccount, setPaymentAccount] = useState('cash')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [savingPayment, setSavingPayment] = useState(false)

  // Invoice Preview Modal State
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false)
  const [invoiceDetail, setInvoiceDetail] = useState(null)
  const [invoiceLoading, setInvoiceLoading] = useState(false)

  useEffect(() => {
    setMenuPortalTarget(document.body)
    fetch('/api/company-profile')
      .then((res) => res.json())
      .then((data) => setCompany(data))
      .catch(() => {})
  }, [])

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
    setPartyId(initialPartyId ? String(initialPartyId) : '')
  }, [type, initialPartyId])

  useEffect(() => {
    setLedger(null)
    setFilters({ from: '', to: '', kind: 'all', search: '' })
    loadLedger(partyId)
  }, [partyId, type])

  const partyOptions = useMemo(() => {
    return [
      {
        value: '',
        label: `🔍 All ${partyLabel}s — Complete History`,
        searchText: `all ${partyLabel.toLowerCase()}s complete history`,
      },
      ...parties.map((party) => {
        const idStr = String(party.id)
        const name = (party.name || party.customer_name || party.supplier_name || '').trim()
        const companyName = (party.company_name || '').trim()
        const phone = (party.phone || party.contact || '').trim()
        const email = (party.email || '').trim()
        const address = (party.address || '').trim()

        let label = ''
        if (isCustomer) {
          label = name || `Customer ${party.id}`
          if (companyName && companyName !== name) label += ` (${companyName})`
          if (phone) label += ` — 📞 ${phone}`
        } else {
          label = companyName || name || `Supplier ${party.id}`
          if (name && companyName && name !== companyName) label = `${name} (${companyName})`
          if (phone) label += ` — 📞 ${phone}`
        }

        const searchText = `${name} ${companyName} ${phone} ${email} ${address} ${idStr}`.toLowerCase()

        return {
          value: idStr,
          label,
          searchText,
          party,
        }
      }),
    ]
  }, [parties, isCustomer, partyLabel])

  const selectedPartyOption = useMemo(() => {
    if (!partyId) {
      return partyOptions[0] || { value: '', label: `🔍 All ${partyLabel}s — Complete History` }
    }
    return (
      partyOptions.find((opt) => opt.value === String(partyId)) || {
        value: String(partyId),
        label: `${partyLabel} ${partyId}`,
      }
    )
  }, [partyOptions, partyId, partyLabel])

  const filterPartyOption = (candidate, input) => {
    if (!input) return true
    const query = input.toLowerCase().trim()
    return (
      candidate.label.toLowerCase().includes(query) ||
      Boolean(candidate.data?.searchText && candidate.data.searchText.includes(query))
    )
  }

  const selectedParty = parties.find((party) => String(party.id) === String(partyId))
  const summary = ledger?.summary || {}
  const currentBalance = Number(summary.balance || 0)

  const filteredEntries = useMemo(() => {
    const query = filters.search.trim().toLowerCase()

    return [...(ledger?.entries || [])]
      .filter((entry) => {
        if (filters.from && entry.entry_date < filters.from) return false
        if (filters.to && entry.entry_date > filters.to) return false
        if (filters.kind === 'payment' && !entry.entry_type?.includes('payment')) return false
        if (
          filters.kind === 'invoice' &&
          entry.reference_type !== (isCustomer ? 'bill' : 'purchase_invoice') &&
          !entry.entry_type?.includes('invoice') &&
          !entry.entry_type?.includes('credit')
        ) {
          return false
        }
        if (
          filters.kind === 'adjustment' &&
          !entry.entry_type?.includes('adjustment') &&
          !entry.entry_type?.includes('debit') &&
          !entry.entry_type?.includes('credit') &&
          !entry.entry_type?.includes('bulk_balance')
        ) {
          return false
        }
        if (query) {
          const itemsText = (entry.items || [])
            .map((it) => `${it.item_name} ${it.qty} ${it.price}`)
            .join(' ')
          const searchHaystack = `${entry.party_name || ''} ${entry.invoice_no || ''} ${entry.description || ''} ${entry.notes || ''} ${entry.source_of_payment || ''} ${itemsText}`.toLowerCase()
          if (!searchHaystack.includes(query)) return false
        }
        return true
      })
      .reverse()
  }, [ledger, filters, isCustomer])

  // Open Edit Balance Modal
  function handleOpenBalanceModal() {
    if (!partyId) {
      setMessage({
        type: 'error',
        text: `Pehle ${partyLabel} select karein jiska balance edit karna hai.`,
      })
      return
    }
    setTargetBalance(String(currentBalance))
    setAdjustAmount('')
    setAdjustDate(today())
    setAdjustNotes(`Balance update for ${selectedParty?.name || partyLabel}`)
    setBalanceModalOpen(true)
  }

  // Save Balance Adjustment
  async function handleSaveBalance(e) {
    e.preventDefault()
    if (!partyId) return
    setSavingBalance(true)

    try {
      const res = await fetch('/api/ledger/adjust-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          partyId: Number(partyId),
          mode: balanceMode,
          targetBalance: Number(targetBalance || 0),
          side: adjustSide,
          amount: Number(adjustAmount || 0),
          entryDate: adjustDate,
          notes: adjustNotes,
        }),
      })

      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Balance edit fail ho gaya.')
      }

      setMessage({
        type: 'success',
        text: json.message || 'Balance successfully update ho gaya.',
      })
      setBalanceModalOpen(false)
      await Promise.all([loadLedger(partyId), loadInitialData()])
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Balance update fail ho gaya.' })
    } finally {
      setSavingBalance(false)
    }
  }

  // Open Payment Modal
  function handleOpenPaymentModal() {
    if (!partyId) {
      setMessage({
        type: 'error',
        text: `Pehle ${partyLabel} select karein jisko payment karni/leni hai.`,
      })
      return
    }
    setPaymentAmount('')
    setPaymentDate(today())
    setPaymentAccount('cash')
    setPaymentNotes('')
    setPaymentModalOpen(true)
  }

  // Submit Payment
  async function handleSavePayment(e) {
    e.preventDefault()
    if (!partyId) return
    setSavingPayment(true)

    try {
      const safeAmount = Number(paymentAmount || 0)
      if (safeAmount <= 0) throw new Error('Enter a valid amount.')

      const selectedBank =
        paymentAccount === 'cash'
          ? null
          : banks.find((bank) => String(bank.id) === String(paymentAccount))

      const sourceOfPayment = selectedBank
        ? `${selectedBank.account_name}${selectedBank.bank_name ? ` - ${selectedBank.bank_name}` : ''}`
        : 'Cash'

      const res = await fetch(`/api/ledger/${type}/${partyId}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: safeAmount,
          entryDate: paymentDate,
          paymentMethod: selectedBank ? 'bank' : 'cash',
          sourceOfPayment,
          bankAccountId: selectedBank?.id || null,
          notes: paymentNotes,
          createdBy: 1,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Payment save nahi ho saki.')

      setMessage({
        type: 'success',
        text: isCustomer
          ? 'Customer payment successfully receive ho gayi.'
          : 'Supplier payment successfully record ho gayi.',
      })
      setPaymentModalOpen(false)
      await Promise.all([loadLedger(partyId), loadInitialData()])
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Payment save nahi ho saki.' })
    } finally {
      setSavingPayment(false)
    }
  }

  // Open Invoice Preview Modal
  async function openInvoiceModal(refId, refType) {
    if (!refId) return
    setInvoiceLoading(true)
    setInvoiceModalOpen(true)
    setInvoiceDetail(null)

    try {
      const isPurchaseBill = refType === 'purchase_invoice' || (!isCustomer && refType !== 'bill')
      const url = isPurchaseBill
        ? `/api/purchase-invoices/${refId}`
        : `/api/invoices/${refId}`

      const res = await fetch(url, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to load invoice')
      setInvoiceDetail(json.data)
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Could not load bill' })
      setInvoiceModalOpen(false)
    } finally {
      setInvoiceLoading(false)
    }
  }

  return (
    <div className="space-y-5 p-2 sm:p-4">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 flex items-center gap-2">
            <span>{isCustomer ? '👥 Customer Ledger' : '🏭 Supplier Ledger'}</span>
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {isCustomer
              ? 'Customer ke khareede huye products (items, qty, rate), payments, aur balance edit ka mukammal khata.'
              : 'Supplier se khareedari (items, qty, rate), adaiygi, aur balance edit ka mukammal record.'}
          </p>
        </div>

        {/* Action Buttons Right at Top Front */}
        <div className="flex flex-wrap items-center gap-2">
          {partyId && (
            <button
              type="button"
              onClick={handleOpenBalanceModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-bold text-white shadow hover:from-amber-600 hover:to-amber-700 transition"
              title="Current balance ko direct edit karein ya adjustment add karein"
            >
              <span>✏️ Edit Balance</span>
            </button>
          )}

          {partyId && (
            <button
              type="button"
              onClick={handleOpenPaymentModal}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold text-white shadow transition ${
                isCustomer
                  ? 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700'
                  : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700'
              }`}
            >
              <span>💰 {isCustomer ? 'Receive Payment' : 'Pay Supplier'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm"
          >
            <span>🖨️ Print</span>
          </button>

          <button
            type="button"
            onClick={() => {
              loadInitialData()
              loadLedger(partyId)
            }}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            title="Refresh Ledger"
          >
            <span>🔄 Refresh</span>
          </button>
        </div>
      </div>

      {/* Alert Messages */}
      {message.text && (
        <div
          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm shadow-sm ${
            message.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-green-200 bg-green-50 text-green-800'
          }`}
        >
          <span>{message.text}</span>
          <button
            onClick={() => setMessage({ type: '', text: '' })}
            className="font-bold text-gray-500 hover:text-gray-800 ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Prominent Search Bar Right in Front */}
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/50 via-white to-blue-50/40 p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-indigo-900 mb-1.5">
              🔍 {partyLabel} Search / Select Karein (Name, Phone, Company, ID):
            </label>
            <Select
              value={selectedPartyOption}
              options={partyOptions}
              onChange={(option) => setPartyId(option?.value || '')}
              filterOption={filterPartyOption}
              isSearchable
              isClearable={Boolean(partyId)}
              placeholder={`Search ${partyLabel.toLowerCase()} by name, phone, company, address...`}
              noOptionsMessage={() => `${partyLabel} nahi mila`}
              isLoading={loading}
              menuPortalTarget={menuPortalTarget}
              menuPosition="fixed"
              className="text-base"
              styles={{
                control: (base, state) => ({
                  ...base,
                  minHeight: '48px',
                  borderRadius: '12px',
                  borderColor: state.isFocused ? '#4f46e5' : '#cbd5e1',
                  boxShadow: state.isFocused ? '0 0 0 3px rgba(99, 102, 241, 0.2)' : 'none',
                  backgroundColor: '#ffffff',
                  fontSize: '15px',
                  fontWeight: '500',
                }),
                menu: (base) => ({ ...base, zIndex: 9999 }),
                menuPortal: (base) => ({ ...base, zIndex: 9999 }),
              }}
            />
          </div>

          {/* If Party is selected, show Quick Edit Balance right next to search */}
          {partyId ? (
            <div className="flex items-center gap-2 pt-2 md:pt-5">
              <button
                type="button"
                onClick={handleOpenBalanceModal}
                className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs font-bold text-amber-800 hover:bg-amber-100 transition shadow-sm whitespace-nowrap flex items-center gap-1.5"
              >
                <span>✏️ Edit Balance</span>
              </button>
              <button
                type="button"
                onClick={() => setPartyId('')}
                className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-xs font-medium text-gray-600 hover:bg-gray-100 whitespace-nowrap"
              >
                Clear Selection
              </button>
            </div>
          ) : (
            <div className="text-xs text-gray-500 pt-2 md:pt-5 italic">
              Kisi specific {partyLabel.toLowerCase()} ka khata dekhne ya balance edit karne ke liye upar search karein.
            </div>
          )}
        </div>
      </div>

      {/* Selected Party Info Banner */}
      {selectedParty && (
        <div className="rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900">
                {selectedParty.name || selectedParty.company_name}
              </h2>
              {selectedParty.company_name && selectedParty.company_name !== selectedParty.name && (
                <span className="text-xs font-medium bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full">
                  {selectedParty.company_name}
                </span>
              )}
              <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                ID #{selectedParty.id}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
              {selectedParty.phone && (
                <span>📞 Phone: <strong className="text-gray-800">{selectedParty.phone}</strong></span>
              )}
              {selectedParty.city && (
                <span>📍 City: <strong className="text-gray-800">{selectedParty.city}</strong></span>
              )}
              {selectedParty.address && (
                <span>🏠 Address: <span className="text-gray-700">{selectedParty.address}</span></span>
              )}
            </div>
          </div>

          {/* Current Balance Badge */}
          <div className="flex items-center gap-3 bg-gray-50 border rounded-xl p-3 md:min-w-[260px] justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Net Current Balance
              </p>
              <p
                className={`text-2xl font-black ${
                  currentBalance > 0
                    ? isCustomer ? 'text-blue-700' : 'text-amber-700'
                    : currentBalance < 0
                      ? isCustomer ? 'text-amber-700' : 'text-blue-700'
                      : 'text-green-700'
                }`}
              >
                Rs {money(Math.abs(currentBalance))}
              </p>
              <p className="text-[10px] font-semibold text-gray-500">
                {currentBalance > 0
                  ? isCustomer ? '🔵 Lena Hai (Receivable)' : '🔴 Dena Hai (Payable)'
                  : currentBalance < 0
                    ? isCustomer ? '🔴 Dena Hai (Payable/Advance)' : '🔵 Lena Hai (Advance Paid)'
                    : '🟢 Account Clear'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenBalanceModal}
              className="rounded-lg bg-amber-500 hover:bg-amber-600 text-white p-2 shadow-sm text-xs font-bold"
              title="Is party ka balance direct edit karein"
            >
              ✏️ Edit
            </button>
          </div>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            {isCustomer ? 'Total Sales (Debit)' : 'Total Purchases (Credit)'}
          </p>
          <p className="mt-1 text-xl sm:text-2xl font-bold text-gray-900">
            Rs {money(isCustomer ? summary.total_debit : summary.total_credit)}
          </p>
          <p className="mt-1 text-[11px] text-gray-400">Total bills amount</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            {isCustomer ? 'Total Payments Received' : 'Total Payments Paid'}
          </p>
          <p className="mt-1 text-xl sm:text-2xl font-bold text-emerald-700">
            Rs {money(isCustomer ? summary.total_credit : summary.total_debit)}
          </p>
          <p className="mt-1 text-[11px] text-gray-400">Total cash/bank cleared</p>
        </div>

        <div className={`rounded-2xl border p-4 shadow-sm ${
          currentBalance !== 0 ? 'border-indigo-300 bg-indigo-50/50' : 'border-gray-200 bg-white'
        }`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-indigo-900 uppercase tracking-wide">
              Current Balance
            </p>
            {partyId && (
              <button
                type="button"
                onClick={handleOpenBalanceModal}
                className="text-[10px] font-bold text-indigo-700 hover:underline"
              >
                Edit
              </button>
            )}
          </div>
          <p className="mt-1 text-xl sm:text-2xl font-black text-indigo-950">
            Rs {money(Math.abs(currentBalance))}
          </p>
          <p className="mt-1 text-[11px] font-medium text-indigo-700">
            {currentBalance > 0
              ? isCustomer ? 'Receivable (Lena Hai)' : 'Payable (Dena Hai)'
              : currentBalance < 0
                ? isCustomer ? 'Payable (Dena Hai)' : 'Receivable (Lena Hai)'
                : 'Account Clear (Rs 0)'}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Ledger Entries
          </p>
          <p className="mt-1 text-xl sm:text-2xl font-bold text-gray-900">
            {filteredEntries.length}
          </p>
          <p className="mt-1 text-[11px] text-gray-400">Total transactions shown</p>
        </div>
      </div>

      {/* Ledger Table Container */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {/* Table Controls & Filters */}
        <div className="border-b p-4 bg-gray-50/50 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-gray-900">
                {selectedParty
                  ? `${selectedParty.name || selectedParty.company_name} — Account Statement`
                  : `All ${partyLabel}s Statement History`}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Har invoice ke items, quantity, rate aur payments ki tafseel.
              </p>
            </div>

            {/* Quick Date Pills */}
            <div className="flex items-center gap-1.5 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setFilters({ ...filters, from: '', to: '' })}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition ${
                  !filters.from && !filters.to
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border-gray-300'
                }`}
              >
                All Time
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date()
                  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
                  setFilters({ ...filters, from: firstDay, to: today() })
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition ${
                  filters.from && filters.to === today()
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border-gray-300'
                }`}
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => setFilters({ ...filters, from: today(), to: today() })}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition ${
                  filters.from === today() && filters.to === today()
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border-gray-300'
                }`}
              >
                Today
              </button>
            </div>
          </div>

          {/* Detailed Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
            <div>
              <span className="text-[11px] font-semibold text-gray-500 block mb-1">From Date:</span>
              <input
                type="date"
                value={filters.from}
                onChange={(e) => setFilters({ ...filters, from: e.target.value })}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-gray-500 block mb-1">To Date:</span>
              <input
                type="date"
                value={filters.to}
                onChange={(e) => setFilters({ ...filters, to: e.target.value })}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-gray-500 block mb-1">Entry Type:</span>
              <select
                value={filters.kind}
                onChange={(e) => setFilters({ ...filters, kind: e.target.value })}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
              >
                <option value="all">All Entries (Bills + Payments)</option>
                <option value="invoice">Invoices / Bills Only</option>
                <option value="payment">Payments Only</option>
                <option value="adjustment">Adjustments & Opening Balance</option>
              </select>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-gray-500 block mb-1">Search within list:</span>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Product name, bill no, note..."
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Ledger Entries Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-sm text-left">
            <thead className="bg-gray-100 text-xs uppercase tracking-wider text-gray-700 border-b">
              <tr>
                <th className="p-3.5 w-24">Date</th>
                <th className="p-3.5 w-36">Type / Ref</th>
                <th className="p-3.5">Details & Purchased Items (Product, Qty, Rate)</th>
                <th className="p-3.5 w-28">Mode</th>
                <th className="p-3.5 text-right w-28">Debit (Dr)</th>
                <th className="p-3.5 text-right w-28">Credit (Cr)</th>
                <th className="p-3.5 text-right w-32">Running Balance</th>
                <th className="p-3.5 text-center w-24 no-print">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-gray-500">
                    <div className="inline-block animate-spin text-2xl mr-2">⏳</div>
                    Ledger statement load ho rahi hai...
                  </td>
                </tr>
              ) : !filteredEntries.length ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-gray-500">
                    <p className="text-base font-semibold text-gray-700">Koi ledger record nahi mila</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Filters check karein ya naya transaction / balance entry karein.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => {
                  const hasItems = Array.isArray(entry.items) && entry.items.length > 0
                  const isBill = Boolean(entry.reference_id && (entry.reference_type === 'bill' || entry.reference_type === 'purchase_invoice'))

                  return (
                    <tr key={entry.id} className="hover:bg-indigo-50/30 transition-colors">
                      {/* Date */}
                      <td className="p-3.5 font-medium whitespace-nowrap align-top text-gray-900">
                        {entry.entry_date}
                      </td>

                      {/* Type & Ref */}
                      <td className="p-3.5 align-top">
                        <span
                          className={`inline-block px-2 py-0.5 text-[11px] font-bold rounded-md ${
                            entry.entry_type?.includes('payment')
                              ? 'bg-emerald-100 text-emerald-800'
                              : entry.entry_type?.includes('sale') || entry.entry_type?.includes('purchase')
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {entryLabel(entry.entry_type)}
                        </span>

                        {entry.invoice_no && (
                          <div className="mt-1">
                            <button
                              type="button"
                              onClick={() => openInvoiceModal(entry.reference_id, entry.reference_type)}
                              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                            >
                              📄 {entry.invoice_no}
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Details & Items (Kaun sa product liya, kitne ka liya, kitni qty) */}
                      <td className="p-3.5 align-top">
                        {!partyId && entry.party_name && (
                          <div className="font-bold text-gray-900 mb-1">
                            👤 {entry.party_name}
                          </div>
                        )}

                        <div className="text-gray-800 font-medium text-xs">
                          {entry.description || '-'}
                        </div>

                        {entry.notes && (
                          <div className="text-[11px] text-gray-500 mt-0.5 italic">
                            Note: {entry.notes}
                          </div>
                        )}

                        {/* Itemized Products Bought/Sold */}
                        {hasItems && (
                          <div className="mt-2 rounded-xl border border-indigo-100 bg-indigo-50/50 p-2.5 text-xs shadow-inner">
                            <div className="flex items-center justify-between text-[11px] font-bold text-indigo-900 mb-1 border-b border-indigo-200/60 pb-1">
                              <span>📦 Tafseel Products / Items ({entry.items.length}):</span>
                              {isBill && (
                                <button
                                  type="button"
                                  onClick={() => openInvoiceModal(entry.reference_id, entry.reference_type)}
                                  className="text-indigo-600 hover:text-indigo-800 font-normal underline"
                                >
                                  View Bill ↗
                                </button>
                              )}
                            </div>

                            <div className="space-y-1 mt-1">
                              {entry.items.map((it, idx) => (
                                <div
                                  key={it.id || idx}
                                  className="flex flex-wrap items-center justify-between gap-2 text-xs py-0.5 border-b border-indigo-100/50 last:border-b-0"
                                >
                                  <span className="font-semibold text-gray-900">
                                    • {it.item_name}
                                    {it.lot_no ? (
                                      <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                        Lot: {it.lot_no}
                                      </span>
                                    ) : null}
                                  </span>
                                  <span className="text-gray-700">
                                    <strong>{it.qty} Qty</strong>
                                    {it.weight > 0 && ` (${it.weight} ${it.weight_unit || 'kg'})`}
                                    {' '}× Rs {money(it.price)} ={' '}
                                    <strong className="text-indigo-900">Rs {money(it.amount)}</strong>
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Payment Mode */}
                      <td className="p-3.5 align-top text-xs text-gray-600 whitespace-nowrap">
                        {entry.source_of_payment || entry.payment_method || '-'}
                      </td>

                      {/* Debit */}
                      <td className="p-3.5 align-top text-right font-semibold text-gray-900 whitespace-nowrap">
                        {entry.debit > 0 ? (
                          <span className={isCustomer ? 'text-gray-900' : 'text-emerald-700'}>
                            Rs {money(entry.debit)}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      {/* Credit */}
                      <td className="p-3.5 align-top text-right font-semibold text-gray-900 whitespace-nowrap">
                        {entry.credit > 0 ? (
                          <span className={isCustomer ? 'text-emerald-700' : 'text-gray-900'}>
                            Rs {money(entry.credit)}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      {/* Running Balance */}
                      <td className="p-3.5 align-top text-right font-bold whitespace-nowrap">
                        <span
                          className={`text-sm ${
                            entry.balance_after > 0
                              ? isCustomer ? 'text-blue-700' : 'text-amber-700'
                              : entry.balance_after < 0
                                ? isCustomer ? 'text-amber-700' : 'text-blue-700'
                                : 'text-green-700'
                          }`}
                        >
                          Rs {money(Math.abs(entry.balance_after))}
                        </span>
                        <div className="text-[10px] font-normal text-gray-400">
                          {entry.balance_after > 0
                            ? isCustomer ? 'Dr (Receivable)' : 'Cr (Payable)'
                            : entry.balance_after < 0
                              ? isCustomer ? 'Cr (Advance)' : 'Dr (Advance)'
                              : 'Nil'}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="p-3.5 align-top text-center no-print">
                        {isBill ? (
                          <button
                            type="button"
                            onClick={() => openInvoiceModal(entry.reference_id, entry.reference_type)}
                            className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition whitespace-nowrap shadow-sm"
                          >
                            View Bill
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 1. EDIT / ADJUST BALANCE MODAL                          */}
      {/* ======================================================== */}
      {balanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4 text-white">
              <div>
                <h3 className="text-lg font-bold">✏️ Edit / Adjust Balance</h3>
                <p className="text-xs text-amber-100">
                  {selectedParty?.name || selectedParty?.company_name} (#{partyId})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBalanceModalOpen(false)}
                className="text-2xl font-bold text-white/80 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBalance} className="p-6 space-y-4">
              {/* Current Balance Display */}
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-gray-500 uppercase">Current Balance:</span>
                  <p className="text-2xl font-black text-gray-900">Rs {money(Math.abs(currentBalance))}</p>
                </div>
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                  currentBalance > 0 ? 'bg-blue-100 text-blue-800' : currentBalance < 0 ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
                }`}>
                  {currentBalance > 0
                    ? isCustomer ? 'Receivable (Lena Hai)' : 'Payable (Dena Hai)'
                    : currentBalance < 0
                      ? isCustomer ? 'Payable (Dena Hai)' : 'Receivable (Lena Hai)'
                      : 'Clear (Rs 0)'}
                </span>
              </div>

              {/* Mode Selection Tabs */}
              <div className="flex rounded-xl bg-gray-100 p-1 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setBalanceMode('direct_balance')}
                  className={`flex-1 rounded-lg py-2 transition ${
                    balanceMode === 'direct_balance'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Direct Set Balance (New Total)
                </button>
                <button
                  type="button"
                  onClick={() => setBalanceMode('adjustment')}
                  className={`flex-1 rounded-lg py-2 transition ${
                    balanceMode === 'adjustment'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Manual Adjustment (+/-)
                </button>
              </div>

              {/* Mode 1: Direct Set Balance */}
              {balanceMode === 'direct_balance' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Naya Target Balance Darj Karein (Rs):
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={targetBalance}
                      onChange={(e) => setTargetBalance(e.target.value)}
                      placeholder="e.g. 5000"
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-base font-bold text-gray-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none"
                      required
                    />
                    <p className="text-[11px] text-gray-500 mt-1">
                      System automatically farq (difference) calculate karke khata me adjustment daal dega.
                    </p>
                  </div>

                  {/* Difference Preview */}
                  {targetBalance !== '' && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900">
                      Farq (Adjustment Amount):{' '}
                      <strong>
                        Rs {money(Math.abs(Number(targetBalance || 0) - currentBalance))}
                      </strong>{' '}
                      ({Number(targetBalance || 0) >= currentBalance ? 'Debit / Balance Barhega' : 'Credit / Balance Kam Hoga'})
                    </div>
                  )}
                </div>
              ) : (
                /* Mode 2: Manual Debit / Credit */
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Adjustment Type:</label>
                      <select
                        value={adjustSide}
                        onChange={(e) => setAdjustSide(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold"
                      >
                        <option value="debit">
                          {isCustomer ? 'Debit (+ Udhaar Barhana)' : 'Debit (- Adaagi)'}
                        </option>
                        <option value="credit">
                          {isCustomer ? 'Credit (- Jama / Adaagi)' : 'Credit (+ Udhaar Barhana)'}
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Amount (Rs):</label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={adjustAmount}
                        onChange={(e) => setAdjustAmount(e.target.value)}
                        placeholder="0"
                        className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-bold"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Date & Reason */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Tareekh (Date):</label>
                  <input
                    type="date"
                    value={adjustDate}
                    onChange={(e) => setAdjustDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Wajah / Reason / Notes:</label>
                  <input
                    type="text"
                    value={adjustNotes}
                    onChange={(e) => setAdjustNotes(e.target.value)}
                    placeholder="e.g. Opening balance correction, Audit adjustment..."
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-3">
                <button
                  type="submit"
                  disabled={savingBalance}
                  className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-700 py-3 text-sm font-bold text-white shadow-md transition disabled:opacity-50"
                >
                  {savingBalance ? 'Saving Adjustment...' : 'Update Balance Now'}
                </button>
                <button
                  type="button"
                  onClick={() => setBalanceModalOpen(false)}
                  className="rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. RECEIVE PAYMENT / PAY SUPPLIER MODAL                 */}
      {/* ======================================================== */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className={`flex items-center justify-between px-6 py-4 text-white ${
              isCustomer ? 'bg-emerald-600' : 'bg-indigo-600'
            }`}>
              <div>
                <h3 className="text-lg font-bold">
                  💰 {isCustomer ? 'Receive Customer Payment' : 'Pay Supplier'}
                </h3>
                <p className="text-xs text-white/80">
                  {selectedParty?.name || selectedParty?.company_name} (#{partyId})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="text-2xl font-bold text-white/80 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  {isCustomer ? 'Cash Received (Rs):' : 'Amount Paid (Rs):'}
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-base font-bold text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Cash / Bank Account:
                </label>
                <select
                  value={paymentAccount}
                  onChange={(e) => setPaymentAccount(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium"
                >
                  <option value="cash">💵 Cash In Hand</option>
                  {banks.map((bank) => (
                    <option key={bank.id} value={bank.id}>
                      🏦 {bank.account_name}
                      {bank.bank_name ? ` (${bank.bank_name})` : ''}
                      {` — Rs ${money(bank.current_balance)}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Date:</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Notes / Description:</label>
                <textarea
                  rows={2}
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Optional details..."
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={savingPayment}
                  className={`flex-1 rounded-xl py-3 text-sm font-bold text-white shadow-md transition disabled:opacity-50 ${
                    isCustomer ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {savingPayment ? 'Saving Payment...' : isCustomer ? 'Save Payment' : 'Pay Supplier'}
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. INVOICE PREVIEW & PRINT MODAL                        */}
      {/* ======================================================== */}
      {invoiceModalOpen && (
        <InvoicePreviewModal
          open={invoiceModalOpen}
          onClose={() => setInvoiceModalOpen(false)}
          invoice={invoiceLoading ? null : invoiceDetail}
          company={company}
          title={invoiceDetail?.invoice_no || invoiceDetail?.purchase_no || 'Invoice Preview'}
        />
      )}
    </div>
  )
}
