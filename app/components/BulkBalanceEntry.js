'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Select from 'react-select'

const emptyRow = () => ({ partyId: '', amount: '', note: '' })

function money(value) {
  return new Intl.NumberFormat('en-PK', { maximumFractionDigits: 2 }).format(Number(value) || 0)
}

export default function BulkBalanceEntry({ type, onOpenLedger }) {
  const isCustomer = type === 'customer'
  const partyLabel = isCustomer ? 'Customer' : 'Supplier'
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [parties, setParties] = useState([])
  const [rows, setRows] = useState([emptyRow()])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [view, setView] = useState('entry')
  const [customers, setCustomers] = useState([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerPage, setCustomerPage] = useState(1)
  const [customerPages, setCustomerPages] = useState(1)
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [customerForm, setCustomerForm] = useState({ name: '', email: '', phone: '', address: '', status: 'Active' })
  const [pendingCustomers, setPendingCustomers] = useState([])
  const [customerSaving, setCustomerSaving] = useState(false)
  const [suppliers, setSuppliers] = useState([])
  const [supplierSearch, setSupplierSearch] = useState('')
  const [supplierPage, setSupplierPage] = useState(1)
  const [supplierPages, setSupplierPages] = useState(1)
  const [showSupplierForm, setShowSupplierForm] = useState(false)
  const [supplierForm, setSupplierForm] = useState({ name: '', company_name: '', email: '', phone: '', address: '', status: 'Active' })
  const [pendingSuppliers, setPendingSuppliers] = useState([])
  const [supplierSaving, setSupplierSaving] = useState(false)
  const [menuPortalTarget, setMenuPortalTarget] = useState(null)
  const nextSelectRef = useRef(null)

  const loadParties = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/ledger/${type}s/summary`)
      const json = await response.json()
      if (!response.ok || !json.success) throw new Error(json.message || `Failed to load ${type}s`)
      setParties(json.data || [])
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setMenuPortalTarget(document.body)
    loadParties()
  }, [type])

  const showCustomers = async (page = customerPage, search = customerSearch) => {
    setView('customers')
    try {
      const qs = new URLSearchParams({ paginate: '1', page: String(page), limit: '50' })
      if (search.trim()) qs.set('search', search.trim())
      const response = await fetch(`/api/customers?${qs}`)
      const json = await response.json()
      if (!response.ok || !json.success) throw new Error(json.message || 'Customers could not be loaded.')
      setCustomers(json.data || [])
      setCustomerPages(json.pagination?.totalPages || 1)
    } catch (error) {
      setMessage(error.message)
    }
  }

  const showSuppliers = async (page = supplierPage, search = supplierSearch) => {
    setView('suppliers')
    try {
      const qs = new URLSearchParams({ paginate: '1', page: String(page), limit: '50' })
      if (search.trim()) qs.set('search', search.trim())
      const response = await fetch(`/api/suppliers?${qs}`)
      const json = await response.json()
      if (!response.ok || !json.success) throw new Error(json.message || 'Suppliers could not be loaded.')
      setSuppliers(json.data || [])
      setSupplierPages(json.pagination?.totalPages || 1)
    } catch (error) {
      setMessage(error.message)
    }
  }

  useEffect(() => {
    if (view !== 'customers') return
    const timer = setTimeout(() => showCustomers(customerPage, customerSearch), 250)
    return () => clearTimeout(timer)
  }, [view, customerPage, customerSearch])

  useEffect(() => {
    if (view !== 'suppliers') return
    const timer = setTimeout(() => showSuppliers(supplierPage, supplierSearch), 250)
    return () => clearTimeout(timer)
  }, [view, supplierPage, supplierSearch])

  const addCustomerRow = (event) => {
    event.preventDefault()
    if (!customerForm.name.trim()) return
    setPendingCustomers((current) => [...current, { ...customerForm, tempId: `${Date.now()}-${current.length}` }])
    setCustomerForm({ name: '', email: '', phone: '', address: '', status: 'Active' })
    setMessage('')
  }

  const saveCustomers = async () => {
    if (!pendingCustomers.length) return
    setCustomerSaving(true)
    setMessage('')
    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: pendingCustomers.map(({ tempId, ...customer }) => customer),
        }),
      })
      const json = await response.json()
      if (!response.ok || !json.success) throw new Error(json.message || 'Customer could not be added.')
      const customersResponse = await fetch('/api/customers')
      const customersJson = await customersResponse.json()
      setCustomers(customersJson.data || [])
      await loadParties()
      const savedCount = pendingCustomers.length
      setPendingCustomers([])
      setCustomerForm({ name: '', email: '', phone: '', address: '', status: 'Active' })
      setShowCustomerForm(false)
      setMessage(`${savedCount} customers successfully add ho gaye.`)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setCustomerSaving(false)
    }
  }

  const addSupplierRow = (event) => {
    event.preventDefault()
    if (!supplierForm.name.trim()) return
    setPendingSuppliers((current) => [...current, { ...supplierForm, tempId: `${Date.now()}-${current.length}` }])
    setSupplierForm({ name: '', company_name: '', email: '', phone: '', address: '', status: 'Active' })
    setMessage('')
  }

  const saveSuppliers = async () => {
    if (!pendingSuppliers.length) return
    setSupplierSaving(true)
    setMessage('')
    try {
      const response = await fetch('/api/suppliers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: pendingSuppliers.map(({ tempId, ...supplier }) => supplier) }),
      })
      const json = await response.json()
      if (!response.ok || !json.success) throw new Error(json.message || 'Suppliers could not be added.')
      const suppliersResponse = await fetch('/api/suppliers')
      const suppliersJson = await suppliersResponse.json()
      setSuppliers(suppliersJson.data || [])
      await loadParties()
      const savedCount = pendingSuppliers.length
      setPendingSuppliers([])
      setSupplierForm({ name: '', company_name: '', email: '', phone: '', address: '', status: 'Active' })
      setShowSupplierForm(false)
      setMessage(`${savedCount} suppliers successfully add ho gaye.`)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSupplierSaving(false)
    }
  }

  const partyMap = useMemo(
    () => new Map(parties.map((party) => [String(party.id), party])),
    [parties]
  )

  const partyOptions = useMemo(() => parties.map((party) => ({
    value: String(party.id),
    label: party.customer_name || party.supplier_name || party.name,
  })), [parties])

  const filteredCustomers = useMemo(() => {
    const search = customerSearch.trim().toLowerCase()
    if (!search) return customers
    return customers.filter((customer) =>
      [customer.name, customer.email, customer.phone, customer.address, customer.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search))
    )
  }, [customers, customerSearch])

  const filteredSuppliers = useMemo(() => {
    const search = supplierSearch.trim().toLowerCase()
    if (!search) return suppliers
    return suppliers.filter((supplier) =>
      [supplier.name, supplier.company_name, supplier.email, supplier.phone, supplier.address, supplier.status]
        .filter(Boolean).some((value) => String(value).toLowerCase().includes(search))
    )
  }, [suppliers, supplierSearch])

  const updateRow = (index, field, value) => {
    setRows((current) => current.map((row, rowIndex) =>
      rowIndex === index ? { ...row, [field]: value } : row
    ))
    setMessage('')
  }

  const addRow = (index) => {
    const row = rows[index]
    if (!row.partyId || !(Number(row.amount) > 0)) {
      setMessage(`Select a ${partyLabel.toLowerCase()} and enter a valid balance.`)
      return
    }
    if (index === rows.length - 1) setRows((current) => [...current, emptyRow()])
    setMessage('')
    setTimeout(() => nextSelectRef.current?.focus(), 0)
  }

  const handleKeyDown = (event, index) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      addRow(index)
    }
  }

  const validRows = rows.filter((row) => row.partyId && Number(row.amount) > 0)

  const saveAll = async () => {
    if (!validRows.length) {
      setMessage('Add at least one complete row before saving.')
      return
    }

    setSaving(true)
    setMessage('')
    try {
      const response = await fetch('/api/ledger/bulk-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, entryDate: date, items: validRows }),
      })
      const json = await response.json()
      if (!response.ok || !json.success) throw new Error(json.message || 'Balances could not be saved.')
      setRows([emptyRow()])
      setMessage(`${json.count} ${type} balance${json.count === 1 ? '' : 's'} successfully update ho gaye.`)
      await loadParties()
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{partyLabel} Balance Entry</h1>
            <p className="mt-1 text-sm text-gray-500">Multiple {type}s ke balances ek saath add karein.</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end">
            <button type="button" onClick={() => view === 'entry' ? (isCustomer ? showCustomers() : showSuppliers()) : setView('entry')} className="rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white hover:bg-indigo-700">{view === 'entry' ? `Show ${partyLabel}s` : 'Balance Entry'}</button>
            <button type="button" onClick={onOpenLedger} className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700">Open Ledger</button>
            {view === 'entry' && <label className="w-full sm:w-64">
              <span className="mb-1 block text-sm font-semibold text-gray-700">Date</span>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
            </label>}
          </div>
        </div>
      </div>

      {view === 'customers' ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="text-xl font-bold text-gray-900">All Customers</h2><p className="text-sm text-gray-500">Total {filteredCustomers.length} customers</p></div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <input type="search" value={customerSearch} onChange={(event) => { setCustomerSearch(event.target.value); setCustomerPage(1) }} placeholder="Search name, phone, email..." className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-indigo-500 sm:w-72" />
              <button type="button" onClick={() => setShowCustomerForm((current) => !current)} className="rounded-lg bg-green-600 px-5 py-2.5 font-semibold text-white hover:bg-green-700">{showCustomerForm ? 'Cancel' : '+ Add Customer'}</button>
            </div>
          </div>
          {showCustomerForm && <form onSubmit={addCustomerRow} className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-indigo-100 bg-indigo-50 p-4 md:grid-cols-2 lg:grid-cols-5">
            <div><label className="mb-1 block text-sm font-semibold">Name *</label><input autoFocus required value={customerForm.name} onChange={(event) => setCustomerForm({ ...customerForm, name: event.target.value })} placeholder="Customer name" className="w-full rounded-lg border border-gray-300 px-3 py-2.5" /></div>
            <div><label className="mb-1 block text-sm font-semibold">Email</label><input type="email" value={customerForm.email} onChange={(event) => setCustomerForm({ ...customerForm, email: event.target.value })} placeholder="Email address" className="w-full rounded-lg border border-gray-300 px-3 py-2.5" /></div>
            <div><label className="mb-1 block text-sm font-semibold">Phone</label><input value={customerForm.phone} onChange={(event) => setCustomerForm({ ...customerForm, phone: event.target.value })} placeholder="Phone number" className="w-full rounded-lg border border-gray-300 px-3 py-2.5" /></div>
            <div><label className="mb-1 block text-sm font-semibold">Address</label><input value={customerForm.address} onChange={(event) => setCustomerForm({ ...customerForm, address: event.target.value })} placeholder="Address" className="w-full rounded-lg border border-gray-300 px-3 py-2.5" /></div>
            <div><label className="mb-1 block text-sm font-semibold">Status</label><div className="flex gap-2"><select value={customerForm.status} onChange={(event) => setCustomerForm({ ...customerForm, status: event.target.value })} className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2.5"><option>Active</option><option>Inactive</option></select><button type="submit" disabled={customerSaving} className="whitespace-nowrap rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white disabled:bg-gray-400">Add Row</button></div></div>
            {pendingCustomers.length > 0 && <div className="md:col-span-2 lg:col-span-5">
              <div className="overflow-x-auto rounded-lg border border-indigo-200 bg-white">
                <table className="w-full min-w-[700px] text-sm"><thead className="bg-indigo-100"><tr><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2 text-left">Email</th><th className="px-3 py-2 text-left">Phone</th><th className="px-3 py-2 text-left">Address</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-left">Action</th></tr></thead>
                  <tbody>{pendingCustomers.map((customer, index) => <tr key={customer.tempId} className="border-t"><td className="px-3 py-2">{index + 1}</td><td className="px-3 py-2 font-semibold">{customer.name}</td><td className="px-3 py-2">{customer.email || '-'}</td><td className="px-3 py-2">{customer.phone || '-'}</td><td className="px-3 py-2">{customer.address || '-'}</td><td className="px-3 py-2">{customer.status}</td><td className="px-3 py-2"><button type="button" onClick={() => setPendingCustomers((current) => current.filter((item) => item.tempId !== customer.tempId))} className="font-medium text-red-600 hover:underline">Remove</button></td></tr>)}</tbody>
                </table>
              </div>
              <div className="mt-3 flex justify-end"><button type="button" onClick={saveCustomers} disabled={customerSaving} className="rounded-lg bg-green-600 px-6 py-2.5 font-bold text-white hover:bg-green-700 disabled:bg-gray-400">{customerSaving ? 'Saving All...' : `Save All Customers (${pendingCustomers.length})`}</button></div>
            </div>}
          </form>}
          {message && <p className={`mb-4 text-sm font-medium ${message.includes('successfully') ? 'text-green-700' : 'text-red-600'}`}>{message}</p>}
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full min-w-[850px] text-sm">
              <thead className="bg-gray-900 text-white"><tr><th className="px-4 py-3 text-left">Name</th><th className="px-4 py-3 text-left">Email</th><th className="px-4 py-3 text-left">Phone</th><th className="px-4 py-3 text-left">Address</th><th className="px-4 py-3 text-left">Previous Balance</th><th className="px-4 py-3 text-left">Status</th></tr></thead>
              <tbody>{filteredCustomers.length ? filteredCustomers.map((customer, index) => <tr key={customer.id} className={`border-t ${index % 2 ? 'bg-gray-50' : 'bg-white'}`}><td className="px-4 py-3 font-semibold text-gray-900">{customer.name || '-'}</td><td className="px-4 py-3">{customer.email || '-'}</td><td className="px-4 py-3">{customer.phone || '-'}</td><td className="px-4 py-3">{customer.address || '-'}</td><td className="px-4 py-3 font-semibold">Rs. {money(partyMap.get(String(customer.id))?.balance)}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${String(customer.status).toLowerCase() === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{customer.status || '-'}</span></td></tr>) : <tr><td colSpan="6" className="px-4 py-10 text-center text-gray-500">No customers found.</td></tr>}</tbody>
            </table>
          </div>
          <Pagination page={customerPage} pages={customerPages} onChange={setCustomerPage} />
        </div>
      ) : view === 'suppliers' ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="text-xl font-bold text-gray-900">All Suppliers</h2><p className="text-sm text-gray-500">Total {filteredSuppliers.length} suppliers</p></div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"><input type="search" value={supplierSearch} onChange={(event) => { setSupplierSearch(event.target.value); setSupplierPage(1) }} placeholder="Search name, company, phone..." className="w-full rounded-lg border border-gray-300 px-3 py-2.5 sm:w-72" /><button type="button" onClick={() => setShowSupplierForm((current) => !current)} className="rounded-lg bg-green-600 px-5 py-2.5 font-semibold text-white hover:bg-green-700">{showSupplierForm ? 'Cancel' : '+ Add Supplier'}</button></div>
          </div>
          {showSupplierForm && <form onSubmit={addSupplierRow} className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-indigo-100 bg-indigo-50 p-4 md:grid-cols-2 lg:grid-cols-6">
            <div><label className="mb-1 block text-sm font-semibold">Name *</label><input autoFocus required value={supplierForm.name} onChange={(event) => setSupplierForm({ ...supplierForm, name: event.target.value })} placeholder="Supplier name" className="w-full rounded-lg border border-gray-300 px-3 py-2.5" /></div>
            <div><label className="mb-1 block text-sm font-semibold">Company</label><input value={supplierForm.company_name} onChange={(event) => setSupplierForm({ ...supplierForm, company_name: event.target.value })} placeholder="Company name" className="w-full rounded-lg border border-gray-300 px-3 py-2.5" /></div>
            <div><label className="mb-1 block text-sm font-semibold">Email</label><input type="email" value={supplierForm.email} onChange={(event) => setSupplierForm({ ...supplierForm, email: event.target.value })} placeholder="Email" className="w-full rounded-lg border border-gray-300 px-3 py-2.5" /></div>
            <div><label className="mb-1 block text-sm font-semibold">Phone</label><input value={supplierForm.phone} onChange={(event) => setSupplierForm({ ...supplierForm, phone: event.target.value })} placeholder="Phone" className="w-full rounded-lg border border-gray-300 px-3 py-2.5" /></div>
            <div><label className="mb-1 block text-sm font-semibold">Address</label><input value={supplierForm.address} onChange={(event) => setSupplierForm({ ...supplierForm, address: event.target.value })} placeholder="Address" className="w-full rounded-lg border border-gray-300 px-3 py-2.5" /></div>
            <div><label className="mb-1 block text-sm font-semibold">Status</label><div className="flex gap-2"><select value={supplierForm.status} onChange={(event) => setSupplierForm({ ...supplierForm, status: event.target.value })} className="min-w-0 flex-1 rounded-lg border border-gray-300 px-2 py-2.5"><option>Active</option><option>Inactive</option></select><button type="submit" className="whitespace-nowrap rounded-lg bg-indigo-600 px-3 py-2.5 font-semibold text-white">Add Row</button></div></div>
            {pendingSuppliers.length > 0 && <div className="md:col-span-2 lg:col-span-6"><div className="overflow-x-auto rounded-lg border border-indigo-200 bg-white"><table className="w-full min-w-[850px] text-sm"><thead className="bg-indigo-100"><tr><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2 text-left">Company</th><th className="px-3 py-2 text-left">Email</th><th className="px-3 py-2 text-left">Phone</th><th className="px-3 py-2 text-left">Address</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2">Action</th></tr></thead><tbody>{pendingSuppliers.map((supplier, index) => <tr key={supplier.tempId} className="border-t"><td className="px-3 py-2">{index + 1}</td><td className="px-3 py-2 font-semibold">{supplier.name}</td><td className="px-3 py-2">{supplier.company_name || '-'}</td><td className="px-3 py-2">{supplier.email || '-'}</td><td className="px-3 py-2">{supplier.phone || '-'}</td><td className="px-3 py-2">{supplier.address || '-'}</td><td className="px-3 py-2">{supplier.status}</td><td className="px-3 py-2"><button type="button" onClick={() => setPendingSuppliers((current) => current.filter((item) => item.tempId !== supplier.tempId))} className="text-red-600">Remove</button></td></tr>)}</tbody></table></div><div className="mt-3 flex justify-end"><button type="button" onClick={saveSuppliers} disabled={supplierSaving} className="rounded-lg bg-green-600 px-6 py-2.5 font-bold text-white disabled:bg-gray-400">{supplierSaving ? 'Saving All...' : `Save All Suppliers (${pendingSuppliers.length})`}</button></div></div>}
          </form>}
          {message && <p className={`mb-4 text-sm font-medium ${message.includes('successfully') ? 'text-green-700' : 'text-red-600'}`}>{message}</p>}
          <div className="overflow-x-auto rounded-xl border border-gray-200"><table className="w-full min-w-[950px] text-sm"><thead className="bg-gray-900 text-white"><tr><th className="px-4 py-3 text-left">Name</th><th className="px-4 py-3 text-left">Company</th><th className="px-4 py-3 text-left">Email</th><th className="px-4 py-3 text-left">Phone</th><th className="px-4 py-3 text-left">Address</th><th className="px-4 py-3 text-left">Previous Balance</th><th className="px-4 py-3 text-left">Status</th></tr></thead><tbody>{filteredSuppliers.length ? filteredSuppliers.map((supplier, index) => <tr key={supplier.id} className={`border-t ${index % 2 ? 'bg-gray-50' : 'bg-white'}`}><td className="px-4 py-3 font-semibold">{supplier.name || '-'}</td><td className="px-4 py-3">{supplier.company_name || '-'}</td><td className="px-4 py-3">{supplier.email || '-'}</td><td className="px-4 py-3">{supplier.phone || '-'}</td><td className="px-4 py-3">{supplier.address || '-'}</td><td className="px-4 py-3 font-semibold">Rs. {money(partyMap.get(String(supplier.id))?.balance)}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${String(supplier.status).toLowerCase() === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{supplier.status || '-'}</span></td></tr>) : <tr><td colSpan="7" className="px-4 py-10 text-center text-gray-500">No suppliers found.</td></tr>}</tbody></table></div>
          <Pagination page={supplierPage} pages={supplierPages} onChange={setSupplierPage} />
        </div>
      ) : <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <div className="min-w-[850px]">
            <div className="grid grid-cols-[minmax(250px,1.5fr)_minmax(150px,.7fr)_minmax(210px,1fr)_minmax(220px,1fr)_90px] gap-3 bg-gray-900 px-5 py-3 text-sm font-semibold text-white">
              <span>{partyLabel} Name</span><span>Previous Balance</span><span>Add Balance</span><span>Note</span><span>Action</span>
            </div>
            {rows.map((row, index) => {
              const selected = partyMap.get(String(row.partyId))
              const selectedIds = new Set(rows.filter((_, i) => i !== index).map((item) => String(item.partyId)))
              return (
                <div key={index} className="grid grid-cols-[minmax(250px,1.5fr)_minmax(150px,.7fr)_minmax(210px,1fr)_minmax(220px,1fr)_90px] items-center gap-3 border-t border-gray-100 px-5 py-3">
                  <Select
                    ref={index === rows.length - 1 ? nextSelectRef : null}
                    value={partyOptions.find((option) => option.value === String(row.partyId)) || null}
                    options={partyOptions.filter((option) => !selectedIds.has(option.value))}
                    onChange={(option) => updateRow(index, 'partyId', option?.value || '')}
                    isDisabled={loading || saving}
                    isLoading={loading}
                    isSearchable
                    isClearable
                    placeholder={`Search ${partyLabel} name...`}
                    noOptionsMessage={() => `${partyLabel} not found`}
                    className="text-sm"
                    menuPortalTarget={menuPortalTarget}
                    menuPosition="fixed"
                    styles={{
                      control: (base, state) => ({
                        ...base,
                        minHeight: '42px',
                        borderRadius: '8px',
                        borderColor: state.isFocused ? '#6366f1' : '#d1d5db',
                        boxShadow: state.isFocused ? '0 0 0 2px #e0e7ff' : 'none',
                      }),
                      menu: (base) => ({ ...base, zIndex: 9999 }),
                      menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                    }}
                  />
                  <div className="rounded-lg bg-gray-50 px-3 py-2.5 font-semibold text-gray-700">Rs. {money(selected?.balance)}</div>
                  <input type="number" min="0.01" step="0.01" value={row.amount} disabled={saving} onChange={(event) => updateRow(index, 'amount', event.target.value)} onKeyDown={(event) => handleKeyDown(event, index)} placeholder="Enter amount" className="rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-indigo-500" />
                  <input value={row.note} disabled={saving} onChange={(event) => updateRow(index, 'note', event.target.value)} onKeyDown={(event) => handleKeyDown(event, index)} placeholder="Optional note" className="rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-indigo-500" />
                  {index === rows.length - 1 ? <button type="button" onClick={() => addRow(index)} disabled={saving} className="rounded-lg bg-indigo-600 px-3 py-2.5 font-semibold text-white hover:bg-indigo-700">Add Row</button> : <button type="button" onClick={() => setRows((current) => current.filter((_, i) => i !== index))} disabled={saving} className="rounded-lg px-3 py-2.5 font-medium text-red-600 hover:bg-red-50">Remove</button>}
                </div>
              )
            })}
          </div>
        </div>
        <div className="flex flex-col items-center gap-3 border-t bg-gray-50 px-5 py-6">
          <button type="button" onClick={saveAll} disabled={saving || loading || !validRows.length} className="min-w-52 rounded-xl bg-green-600 px-8 py-3 font-bold tracking-[0.2em] text-white shadow-md hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400">{saving ? 'SAVING...' : 'SAVE ALL'}</button>
          {message && <p className={`text-sm font-medium ${message.includes('successfully') ? 'text-green-700' : 'text-red-600'}`}>{message}</p>}
        </div>
      </div>}
    </div>
  )
}

function Pagination({ page, pages, onChange }) {
  return <div className="mt-4 flex items-center justify-between"><button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-40">Previous</button><span className="text-sm text-gray-600">Page {page} of {Math.max(pages, 1)}</span><button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-40">Next</button></div>
}
