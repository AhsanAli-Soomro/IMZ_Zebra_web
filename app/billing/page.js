'use client'

import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import InvoicePreviewModal from '../components/InvoicePreviewModal'
import Navbar from '../components/Navbar'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function money(value) {
  return Number(value || 0).toLocaleString()
}

export default function BillingPage({ selectedCustomerId = null }) {
  const [customers, setCustomers] = useState([])
  const [stocks, setStocks] = useState([])
  const [categories, setCategories] = useState([])
  const [company, setCompany] = useState(null)

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [createdInvoice, setCreatedInvoice] = useState(null)
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false)
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [invoiceDetail, setInvoiceDetail] = useState(null)
  const [editingInvoiceId, setEditingInvoiceId] = useState(null)

  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedCustomerMode, setSelectedCustomerMode] = useState('manual')
  const [manualCustomer, setManualCustomer] = useState({
    name: '',
    phone: '',
    address: '',
  })

  const [form, setForm] = useState({
    customerId: '',
    invoiceDate: today(),
    dueDate: today(),
    paymentType: 'cash',
    paidAmount: '',
    discount: '',
    tax: '',
    shipping: '',
    notes: '',
  })

  const [items, setItems] = useState([
    {
      id: `row-${Date.now()}`,
      stockId: '',
      qty: 1,
      price: '',
      discount: 0,
      tax: 0,
    },
  ])

  const currentCustomer =
    customers.find((c) => String(c.id) === String(form.customerId)) || null

  const customerDisplay = currentCustomer
    ? {
        name: currentCustomer.name || currentCustomer.customer_name || '',
        phone: currentCustomer.phone || currentCustomer.contact || '',
        address: currentCustomer.address || '',
      }
    : {
        name: manualCustomer.name || 'Walk-in Customer',
        phone: manualCustomer.phone || '',
        address: manualCustomer.address || '',
      }

  const visibleCartItems = useMemo(() => {
    return items.filter((item) => item.stockId)
  }, [items])

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => {
      const qty = Number(item.qty || 0)
      const price = Number(item.price || 0)
      return sum + qty * price
    }, 0)

    const itemDiscount = items.reduce((sum, item) => sum + Number(item.discount || 0), 0)
    const itemTax = items.reduce((sum, item) => sum + Number(item.tax || 0), 0)

    const discount = Number(form.discount || 0)
    const tax = Number(form.tax || 0)
    const shipping = Number(form.shipping || 0)

    const total = subtotal - itemDiscount - discount + itemTax + tax + shipping

    return {
      subtotal,
      itemDiscount,
      itemTax,
      total,
      qty: items.reduce((sum, item) => sum + Number(item.qty || 0), 0),
    }
  }, [items, form.discount, form.tax, form.shipping])

  const filteredStocks = useMemo(() => {
    if (selectedCategory === 'all') return stocks
    return stocks.filter((s) => s.category === selectedCategory)
  }, [stocks, selectedCategory])

  useEffect(() => {
    if (selectedCustomerId) {
      setSelectedCustomerMode('existing')
      setForm((prev) => ({
        ...prev,
        customerId: String(selectedCustomerId),
      }))
    }
  }, [selectedCustomerId])

  useEffect(() => {
    async function loadCompany() {
      try {
        const res = await fetch('/api/company-profile')
        const data = await res.json()
        setCompany(data)
      } catch (err) {
        console.error('Company profile load failed', err)
      }
    }

    loadCompany()
  }, [])

  useEffect(() => {
    async function loadCustomers() {
      try {
        const res = await fetch('/api/customers')
        const data = await res.json()
        if (data?.success) setCustomers(data.data || [])
      } catch (e) {
        console.error('Customers load failed', e)
      }
    }

    async function loadStocks() {
      try {
        const res = await fetch('/api/stocks')
        const data = await res.json()
        if (data?.success) setStocks(data.data || [])
      } catch (e) {
        console.error('Stocks load failed', e)
      }
    }

    async function loadCategories() {
      try {
        const res = await fetch('/api/categories')
        const data = await res.json()
        setCategories(Array.isArray(data?.data) ? data.data : [])
      } catch (e) {
        console.error('Categories load failed', e)
        setCategories([])
      }
    }

    loadCustomers()
    loadStocks()
    loadCategories()
  }, [])

  useEffect(() => {
    if (form.paymentType === 'cash') {
      setForm((prev) => ({
        ...prev,
        paidAmount: String(totals.total || 0),
      }))
    } else if (form.paymentType === 'credit') {
      setForm((prev) => ({
        ...prev,
        paidAmount: '0',
      }))
    }
  }, [form.paymentType, totals.total])

  function updateItemByRowId(rowId, key, value) {
    setItems((prev) =>
      prev.map((item) => (item.id === rowId ? { ...item, [key]: value } : item))
    )
  }

  function removeItemByRowId(rowId) {
    setItems((prev) => {
      const updated = prev.filter((item) => item.id !== rowId)
      return updated.length
        ? updated
        : [
            {
              id: `row-${Date.now()}`,
              stockId: '',
              qty: 1,
              price: '',
              discount: 0,
              tax: 0,
            },
          ]
    })
  }

  function addItemRow(stock = null) {
    if (stock) {
      const autoPrice =
        Number(stock?.sale_price || 0) > 0
          ? Number(stock.sale_price)
          : Number(stock?.selling_price || 0) > 0
            ? Number(stock.selling_price)
            : 0

      const existingItem = items.find((item) => String(item.stockId) === String(stock.id))

      if (existingItem) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === existingItem.id
              ? { ...item, qty: Number(item.qty || 0) + 1 }
              : item
          )
        )
        return
      }

      const hasEmptyRow = items.some((item) => !item.stockId)

      if (hasEmptyRow) {
        setItems((prev) =>
          prev.map((item) =>
            !item.stockId
              ? {
                  ...item,
                  stockId: String(stock.id),
                  qty: 1,
                  price: autoPrice,
                  discount: 0,
                  tax: 0,
                }
              : item
          )
        )
        return
      }

      setItems((prev) => [
        ...prev,
        {
          id: `row-${Date.now()}-${stock.id}`,
          stockId: String(stock.id),
          qty: 1,
          price: autoPrice,
          discount: 0,
          tax: 0,
        },
      ])
      return
    }

    setItems((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}`,
        stockId: '',
        qty: 1,
        price: '',
        discount: 0,
        tax: 0,
      },
    ])
  }

  function handleStockSelect(rowId, stockId) {
    const stock = stocks.find((s) => String(s.id) === String(stockId))

    const autoPrice =
      Number(stock?.sale_price || 0) > 0
        ? Number(stock.sale_price)
        : Number(stock?.selling_price || 0) > 0
          ? Number(stock.selling_price)
          : 0

    setItems((prev) =>
      prev.map((item) =>
        item.id === rowId
          ? {
              ...item,
              stockId,
              price: autoPrice,
            }
          : item
      )
    )
  }

async function handleAddManualCustomer() {
  if (!manualCustomer.name.trim()) {
    toast.info('Name is required')
    return
  }

  try {
    const payload = {
      name: manualCustomer.name.trim(),
      email: '',
      phone: manualCustomer.phone?.trim() || '',
      address: manualCustomer.address?.trim() || '',
      status: 'Active',
    }

    const res = await axios.post('/api/customers', payload)

    if (!res.data?.success) {
      throw new Error(res.data?.message || 'Failed to add customer')
    }

    toast.success('Customer added successfully')

    const refreshed = await axios.get('/api/customers')
    const updatedCustomers = refreshed.data?.data || []
    setCustomers(updatedCustomers)

    const newCustomer = updatedCustomers.find(
      (c) =>
        String(c.name || '').trim().toLowerCase() === payload.name.toLowerCase() &&
        String(c.phone || '').trim() === payload.phone
    )

    if (newCustomer) {
      setSelectedCustomerMode('existing')
      setForm((prev) => ({
        ...prev,
        customerId: String(newCustomer.id),
      }))
    }

    setManualCustomer({
      name: payload.name,
      phone: payload.phone,
      address: payload.address,
    })
  } catch (error) {
    console.error('Customer save failed:', error)
    toast.error(error?.response?.data?.message || error.message || 'Failed to save customer')
  }
}

  function resetForm() {
    setEditingInvoiceId(null)
    setSelectedCustomerMode('manual')
    setManualCustomer({
      name: '',
      phone: '',
      address: '',
    })
    setForm({
      customerId: '',
      invoiceDate: today(),
      dueDate: today(),
      paymentType: 'cash',
      paidAmount: '',
      discount: '',
      tax: '',
      shipping: '',
      notes: '',
    })
    setItems([
      {
        id: `row-${Date.now()}`,
        stockId: '',
        qty: 1,
        price: '',
        discount: 0,
        tax: 0,
      },
    ])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const validItems = items.filter((item) => Number(item.stockId) && Number(item.qty) > 0)

      if (!validItems.length) {
        throw new Error('Invoice items mein valid product aur qty required hai')
      }

      if (selectedCustomerMode === 'existing' && !form.customerId) {
        throw new Error('Customer select karein')
      }

      if (selectedCustomerMode === 'manual' && !manualCustomer.name.trim()) {
        throw new Error('Manual customer name required hai')
      }

      if (form.paymentType === 'partial') {
        const partialPaid = Number(form.paidAmount || 0)

        if (partialPaid <= 0) {
          throw new Error('Partial payment ke liye valid paid amount enter karein')
        }

        if (partialPaid >= totals.total) {
          throw new Error('Partial payment total se kam honi chahiye')
        }
      }

      const payload = {
        customerId:
          selectedCustomerMode === 'existing' && form.customerId
            ? Number(form.customerId)
            : null,
        customerName: selectedCustomerMode === 'manual' ? manualCustomer.name : undefined,
        customerPhone: selectedCustomerMode === 'manual' ? manualCustomer.phone : undefined,
        customerAddress:
          selectedCustomerMode === 'manual' ? manualCustomer.address : undefined,
        invoiceDate: form.invoiceDate,
        dueDate: form.dueDate,
        paymentType: form.paymentType,
        paidAmount:
          form.paymentType === 'cash'
            ? Number(totals.total || 0)
            : form.paymentType === 'credit'
              ? 0
              : Number(form.paidAmount || 0),
        discount: Number(form.discount || 0),
        tax: Number(form.tax || 0),
        shipping: Number(form.shipping || 0),
        notes: form.notes,
        createdBy: 1,
        items: validItems.map((item) => ({
          stockId: Number(item.stockId),
          qty: Number(item.qty),
          price: Number(item.price),
          discount: Number(item.discount || 0),
          tax: Number(item.tax || 0),
        })),
      }

      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      let data = null
      try {
        data = await res.json()
      } catch {
        throw new Error('Server se valid response nahi mila')
      }

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to create invoice')
      }

      const savedInvoice = data.data
      const newInvoiceId = savedInvoice?.id

      setCreatedInvoice(savedInvoice)

      setMessage(
        editingInvoiceId
          ? `Invoice save ho gayi. Nayi invoice create hui: ${savedInvoice.invoice_no}`
          : `Invoice created successfully: ${savedInvoice.invoice_no}`
      )

      resetForm()

      if (newInvoiceId) {
        try {
          await openInvoiceModal(newInvoiceId)
        } catch (modalError) {
          console.error('Invoice saved but modal open failed:', modalError)
          setMessage(
            `Invoice save ho gayi (${savedInvoice.invoice_no}), lekin preview open nahi hui.`
          )
        }
      }
    } catch (error) {
      setMessage(error.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function openInvoiceModal(invoiceId) {
    try {
      setInvoiceModalOpen(true)
      setInvoiceLoading(true)
      setInvoiceDetail(null)

      const res = await fetch(`/api/invoices/${invoiceId}`, {
        cache: 'no-store',
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to load invoice')
      }

      setInvoiceDetail(data.data)
    } catch (error) {
      setMessage(error.message || 'Failed to load invoice')
      setInvoiceModalOpen(false)
    } finally {
      setInvoiceLoading(false)
    }
  }

  function closeInvoiceModal() {
    setInvoiceModalOpen(false)
    setInvoiceDetail(null)
  }

  function handleEditInvoice() {
    if (!invoiceDetail) return

    setEditingInvoiceId(invoiceDetail.id || null)

    if (invoiceDetail.customer_id) {
      setSelectedCustomerMode('existing')
    } else {
      setSelectedCustomerMode('manual')
      setManualCustomer({
        name: invoiceDetail.customer_name || '',
        phone: invoiceDetail.customer_phone || '',
        address: invoiceDetail.customer_address || '',
      })
    }

    setForm({
      customerId: invoiceDetail.customer_id ? String(invoiceDetail.customer_id) : '',
      invoiceDate: invoiceDetail.invoice_date || today(),
      dueDate: invoiceDetail.due_date || today(),
      paymentType: invoiceDetail.payment_type || 'cash',
      paidAmount: String(invoiceDetail.paid_amount || ''),
      discount: String(invoiceDetail.discount || ''),
      tax: String(invoiceDetail.tax || ''),
      shipping: String(invoiceDetail.shipping || ''),
      notes: invoiceDetail.notes || '',
    })

    const mappedItems =
      (invoiceDetail.items || []).map((item, index) => ({
        id: `edit-row-${index}-${item.stock_id || item.stockId || item.product_id || index}`,
        stockId: String(item.stock_id || item.stockId || item.product_id || ''),
        qty: Number(item.qty || 1),
        price: String(item.price || ''),
        discount: Number(item.discount || 0),
        tax: Number(item.tax || 0),
      })) || []

    setItems(
      mappedItems.length
        ? mappedItems
        : [
            {
              id: `row-${Date.now()}`,
              stockId: '',
              qty: 1,
              price: '',
              discount: 0,
              tax: 0,
            },
          ]
    )

    closeInvoiceModal()

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })

    setMessage(
      'Invoice form mein load ho gayi hai. Save karne par abhi nayi invoice create hogi jab tak update API add nahi hoti.'
    )
  }

  const actualPaid =
    form.paymentType === 'cash'
      ? totals.total
      : form.paymentType === 'credit'
        ? 0
        : Number(form.paidAmount || 0)

  const remaining = totals.total - actualPaid

  return (
    <>
    <Navbar />
      <div className="min-h-screen bg-gray-50 font-sans text-gray-800 flex flex-col">
        <div className="flex flex-1 overflow-hidden">
          <aside className="w-[350px] bg-white border-r p-6 shadow-lg space-y-6 overflow-y-auto">
            <div className="border-b pb-3">
              <h2 className="text-xl font-semibold text-gray-700 mb-2">Customer Details</h2>

              <select
                value={selectedCustomerMode === 'manual' ? 'manual' : form.customerId}
                onChange={(e) => {
                  const val = e.target.value

                  if (val === 'manual') {
                    setSelectedCustomerMode('manual')
                    setForm((prev) => ({ ...prev, customerId: '' }))
                  } else {
                    setSelectedCustomerMode('existing')
                    setForm((prev) => ({ ...prev, customerId: val }))
                  }
                }}
                className="border px-3 py-2 w-full rounded shadow-sm bg-white focus:ring-2 focus:ring-indigo-500"
              >
                <option value="manual">Manual Entry</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.customer_name} ({c.phone || c.contact || 'No phone'})
                  </option>
                ))}
              </select>

              {selectedCustomerMode === 'manual' && (
                <>
                  <input
                    placeholder="Name"
                    className="border px-3 py-2 w-full rounded shadow-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none mt-3"
                    value={manualCustomer.name}
                    onChange={(e) =>
                      setManualCustomer((prev) => ({ ...prev, name: e.target.value }))
                    }
                  />
                  <input
                    placeholder="Contact"
                    className="border px-3 py-2 w-full rounded shadow-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none mt-3"
                    value={manualCustomer.phone}
                    onChange={(e) =>
                      setManualCustomer((prev) => ({ ...prev, phone: e.target.value }))
                    }
                  />
                  <input
                    placeholder="Address"
                    className="border px-3 py-2 w-full rounded shadow-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none mt-3"
                    value={manualCustomer.address}
                    onChange={(e) =>
                      setManualCustomer((prev) => ({ ...prev, address: e.target.value }))
                    }
                  />

                  <button
                    type="button"
                    onClick={handleAddManualCustomer}
                    className="bg-indigo-600 text-white w-full py-2 rounded hover:bg-indigo-700 text-sm mt-3"
                  >
                    Add to Customer List
                  </button>
                </>
              )}
            </div>

            <div className="mb-4">
              <h2 className="font-semibold text-lg mb-2">Cart</h2>

              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {visibleCartItems.map((item) => {
                  const stock = stocks.find((s) => String(s.id) === String(item.stockId))

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2 border rounded hover:bg-gray-50 transition"
                    >
                      <div className="flex-1">
                        <div>{stock?.item_name || 'Product'}</div>
                        <button
                          type="button"
                          onClick={() => removeItemByRowId(item.id)}
                          className="text-xs text-red-500 mt-1"
                        >
                          Remove
                        </button>
                      </div>

                      <input
                        type="number"
                        min="1"
                        className="w-16 text-right border rounded px-1 py-0.5 ml-2"
                        value={item.qty}
                        onChange={(e) =>
                          updateItemByRowId(
                            item.id,
                            'qty',
                            Math.max(1, parseInt(e.target.value || '1', 10) || 1)
                          )
                        }
                      />

                      <div className="ml-2 min-w-[80px] text-right">
                        Rs {money(Number(item.qty || 0) * Number(item.price || 0))}
                      </div>
                    </div>
                  )
                })}

                {!visibleCartItems.length && (
                  <div className="text-sm text-gray-500 italic">No items selected</div>
                )}
              </div>
            </div>

            <div className="border-t pt-4 space-y-2 text-sm text-gray-700 bg-gray-50 p-3 rounded shadow-inner">
              <p className="flex justify-between">
                <span>Total Qty:</span>
                <span>{totals.qty}</span>
              </p>
              <p className="flex justify-between">
                <span>Subtotal:</span>
                <span>Rs {money(totals.subtotal)}</span>
              </p>
              <p className="flex justify-between">
                <span>Items Discount:</span>
                <span>Rs {money(totals.itemDiscount)}</span>
              </p>
              <p className="flex justify-between">
                <span>Items Tax:</span>
                <span>Rs {money(totals.itemTax)}</span>
              </p>
              <p className="flex justify-between font-bold mt-2">
                <span>Net Pay:</span>
                <span>Rs {money(totals.total)}</span>
              </p>
            </div>

            <div className="flex flex-col space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium">Payment Type</label>
                <select
                  value={form.paymentType}
                  onChange={(e) => setForm({ ...form, paymentType: e.target.value })}
                  className="w-32 text-right border px-2 py-1 rounded focus:ring-indigo-400"
                >
                  <option value="cash">Cash</option>
                  <option value="credit">Credit</option>
                  <option value="partial">Partial</option>
                </select>
              </div>

              <div className="flex justify-between items-center">
                <label className="text-sm font-medium">Discount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.discount}
                  onChange={(e) => setForm({ ...form, discount: e.target.value })}
                  className="w-24 text-right border px-2 py-1 rounded focus:ring-indigo-400"
                />
              </div>

              <div className="flex justify-between items-center">
                <label className="text-sm font-medium">Tax</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.tax}
                  onChange={(e) => setForm({ ...form, tax: e.target.value })}
                  className="w-24 text-right border px-2 py-1 rounded focus:ring-indigo-400"
                />
              </div>

              <div className="flex justify-between items-center">
                <label className="text-sm font-medium">Shipping</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.shipping}
                  onChange={(e) => setForm({ ...form, shipping: e.target.value })}
                  className="w-24 text-right border px-2 py-1 rounded focus:ring-indigo-400"
                />
              </div>

              <div className="flex justify-between items-center">
                <label className="text-sm font-medium">Amount Paid</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={form.paymentType !== 'partial'}
                  value={form.paidAmount}
                  onChange={(e) => setForm({ ...form, paidAmount: e.target.value })}
                  className={`w-24 text-right border px-2 py-1 rounded focus:ring-indigo-400 ${
                    form.paymentType !== 'partial' ? 'bg-gray-100 cursor-not-allowed' : ''
                  }`}
                />
              </div>
            </div>

            <div className="border-t pt-4 text-sm space-y-1">
              <p className="flex justify-between">
                <span>Paid:</span>
                <span>Rs {money(actualPaid)}</span>
              </p>
              <p className="flex justify-between font-semibold">
                <span>Remaining:</span>
                <span>Rs {money(remaining)}</span>
              </p>
            </div>
          </aside>

          <main className="flex-1 p-4 overflow-y-auto">
            <div className="mb-4 w-full max-w-xs">
              <label className="block mb-1 font-semibold text-gray-700">Filter by Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="border px-3 py-2 w-full rounded shadow-sm"
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {message && (
              <div className="mb-4 border border-indigo-200 rounded-md bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
                {message}
              </div>
            )}

            {createdInvoice && (
              <div className="mb-4 border border-gray-200 rounded-lg bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Last Created Invoice</p>
                    <h3 className="text-lg font-bold text-gray-900">
                      {createdInvoice.invoice_no || 'Invoice'}
                    </h3>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => openInvoiceModal(createdInvoice.id)}
                      className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                    >
                      View Invoice
                    </button>

                    <button
                      type="button"
                      onClick={resetForm}
                      className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      New Invoice
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
              {filteredStocks.map((stock) => {
                const displayPrice =
                  Number(stock?.sale_price || 0) > 0
                    ? Number(stock.sale_price)
                    : Number(stock?.selling_price || 0)

                return (
                  <div
                    key={stock.id}
                    onClick={() => addItemRow(stock)}
                    className="bg-white rounded-lg shadow-md p-4 hover:shadow-xl transition cursor-pointer flex flex-col items-center"
                  >
                    {stock.image_path ? (
                      <img
                        src={stock.image_path}
                        alt={stock.item_name}
                        className="h-14 w-14 mb-2 object-cover rounded"
                      />
                    ) : (
                      <div className="h-14 w-14 mb-2 flex items-center justify-center bg-gray-100 rounded text-xs text-gray-500">
                        No Image
                      </div>
                    )}

                    <h3 className="text-sm font-medium text-center">{stock.item_name}</h3>
                    <p
                      className={`text-xs ${
                        Number(stock.quantity) < 5
                          ? 'text-red-500 font-semibold'
                          : 'text-gray-500'
                      }`}
                    >
                      Stock: {stock.quantity}
                    </p>

                    <p className="text-sm font-semibold text-indigo-600 mt-1">
                      Rs {money(displayPrice)}
                    </p>
                  </div>
                )
              })}
            </div>
          </main>
        </div>

        <footer className="bg-white border-t px-6 py-4 flex justify-between items-center shadow-md">
          <div className="space-x-4">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded transition shadow-sm"
            >
              {loading
                ? 'Saving Invoice...'
                : editingInvoiceId
                  ? 'Save as New Invoice'
                  : 'Create Invoice'}
            </button>

            <button
              type="button"
              onClick={resetForm}
              className="bg-gray-600 hover:bg-gray-700 text-white px-5 py-2 rounded transition shadow-sm"
            >
              Reset
            </button>
          </div>

          <div className="text-sm text-gray-500 space-x-4">
            <button className="hover:text-indigo-500 transition">Settings</button>
            <button className="hover:text-indigo-500 transition">Help</button>
          </div>
        </footer>
      </div>

      {invoiceModalOpen && (
        <InvoicePreviewModal
          open={invoiceModalOpen}
          onClose={closeInvoiceModal}
          invoice={invoiceLoading ? null : invoiceDetail}
          company={company}
          title={invoiceDetail?.invoice_no || 'Invoice Detail'}
          showEditButton={true}
          onEdit={handleEditInvoice}
          message={message}
          setMessage={setMessage}
        />
      )}
    </>
  )
}