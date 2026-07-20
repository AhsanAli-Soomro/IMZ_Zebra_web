'use client'

import { useEffect, useMemo, useState } from 'react'
import InvoicePreviewModal from './InvoicePreviewModal'
import Select from "react-select";

function today() {
  return new Date().toISOString().slice(0, 10)
}

function money(value) {
  return Number(value || 0).toLocaleString()
}

function lineAmount(item) {
  const qty = Number(item.qty || 0)
  const price = Number(item.price || 0)

  return qty * price
}

export default function InvoiceCreate({ selectedCustomerId = null }) {
  const [customers, setCustomers] = useState([])
  const [stocks, setStocks] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [createdInvoice, setCreatedInvoice] = useState(null)
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false)
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [invoiceDetail, setInvoiceDetail] = useState(null)
  const [company, setCompany] = useState(null)
  const [editingInvoiceId, setEditingInvoiceId] = useState(null)

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
      stockId: '',
      itemName: '',
      qty: 1,
      weight: '',
      price: '',
      amount: '',
      discount: 0,
      tax: 0,
    },
  ])

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + lineAmount(item), 0)

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
    }
  }, [items, form.discount, form.tax, form.shipping])

  const fieldClass =
    'w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:border-indigo-500'

  const labelClass = 'mb-1 block text-sm font-medium text-gray-700'
  const cardClass = 'border border-gray-200 rounded-lg bg-white p-4 shadow-sm'

  const customerName =
    customers.find((c) => String(c.id) === String(form.customerId))?.name ||
    'Walk-in Customer'

  useEffect(() => {
    if (selectedCustomerId) {
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

  useEffect(() => {
    loadCustomers()
    loadStocks()
  }, [])

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

  function emptyItem() {
    return {
      stockId: '',
      itemName: '',
      qty: 1,
      weight: '',
      weight_unit: 'kg',
      price: '',
      amount: '',
      discount: 0,
      tax: 0,
    }
  }

  function addItemRow() {
    setItems((prev) => [...prev, emptyItem()])
  }

  function removeItemRow(index) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function updateItem(index, key, value) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item

        const updated = { ...item, [key]: value }

        if (key === 'qty' || key === 'weight' || key === 'price') {
          updated.amount = lineAmount(updated)
        }

        return updated
      })
    )
  }

  function handleStockSelect(index, stockId) {
    const stock = stocks.find((s) => String(s.id) === String(stockId))

    const autoPrice = 0

    const weight = Number(stock?.weight || 0)
    const weightUnit = stock?.weight_unit || 'kg'
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
            ...item,
            stockId,
            itemName: stock?.item_name || '',
            price: autoPrice,
            weight,
            weight_unit: weightUnit,
            amount: lineAmount({ ...item, price: autoPrice }),
          }
          : item
      )
    )
  }

  function resetForm() {
    setEditingInvoiceId(null)
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
    setItems([emptyItem()])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      if (!items.length || items.some((item) => !Number(item.stockId) || Number(item.qty) <= 0)) {
        throw new Error('Invoice items mein valid product aur qty required hai')
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
        customerId: form.customerId ? Number(form.customerId) : null,
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
        shipping: Number(
          form.transportExpense ||
          form.shipping ||
          0
        ),
        notes: form.notes,
        createdBy: 1,

        items: items.map((item) => {
          const stock = stocks.find((s) => String(s.id) === String(item.stockId))
          const qty = Number(item.qty || 0)
          const weight = Number(item.weight || stock?.weight || 0)
          const price = Number(item.price || 0)
          const amount = qty * price
          const name = stock?.item_name || item.itemName || ''

          return {
            stockId: Number(item.stockId),
            itemName: name,
            item_name: name,
            productName: name,
            product_name: name,
            qty,
            weight,
            weightUnit: item.weight_unit || stock?.weight_unit || 'kg',
            weight_unit: item.weight_unit || stock?.weight_unit || 'kg',
            price,
            amount,
            discount: Number(item.discount || 0),
            tax: Number(item.tax || 0),
          }
        }),
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
        await openInvoiceModal(newInvoiceId)
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
      (invoiceDetail.items || []).map((item) => ({
        stockId: String(item.stock_id || item.stockId || item.product_id || ''),
        itemName: item.item_name || item.product_name || '',
        qty: Number(item.qty || 1),
        weight: Number(item.weight || 0),
        price: String(item.price || ''),
        amount: Number(item.amount || 0),
        discount: Number(item.discount || 0),
        tax: Number(item.tax || 0),
        weight_unit: item.weight_unit || item.weightUnit || 'kg',
      })) || []

    setItems(mappedItems.length ? mappedItems : [emptyItem()])

    closeInvoiceModal()

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })

    setMessage(
      'Invoice form mein load ho gayi hai. Save karne par abhi nayi invoice create hogi jab tak update API add nahi hoti.'
    )
  }

  return (
    <>
      <div className="space-y-6">
        <div className="border border-gray-200 rounded-lg bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Create Invoice</h2>
              <p className="mt-1 text-sm text-gray-600">
                Sale invoice banayen, stock minus karein, aur payment handle karein.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:w-auto">
              <div className="border border-gray-200 rounded-md px-3 py-2 bg-gray-50">
                <p className="text-xs text-gray-500">Customer</p>
                <p className="text-sm font-medium text-gray-900 truncate">{customerName}</p>
              </div>

              <div className="border border-gray-200 rounded-md px-3 py-2 bg-gray-50">
                <p className="text-xs text-gray-500">Total</p>
                <p className="text-sm font-medium text-gray-900">Rs {money(totals.total)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* {message && (
          <div className="border border-indigo-200 rounded-md bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
            {message}
          </div>
        )} */}

        {createdInvoice && (
          <div className="border border-gray-200 rounded-lg bg-white p-4 shadow-sm">
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

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="border border-gray-200 rounded-lg bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Invoice Info</h3>
              {editingInvoiceId && (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                  Edit mode loaded
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className={labelClass}>Customer</label>

                <Select
                  options={[
                    {
                      value: "",
                      label: "Walk-in Customer",
                    },
                    ...customers.map((customer) => ({
                      value: customer.id,
                      label:
                        customer.name ||
                        customer.customer_name ||
                        `${customer.first_name || ""} ${customer.middle_name || ""} ${customer.last_name || ""}`.trim(),
                    })),
                  ]}
                  value={
                    form.customerId
                      ? {
                        value: form.customerId,
                        label:
                          customers.find(
                            (c) => String(c.id) === String(form.customerId)
                          )?.name ||
                          customers.find(
                            (c) => String(c.id) === String(form.customerId)
                          )?.customer_name,
                      }
                      : {
                        value: "",
                        label: "Walk-in Customer",
                      }
                  }
                  onChange={(selected) =>
                    setForm({
                      ...form,
                      customerId: selected?.value || "",
                    })
                  }
                  isSearchable
                  placeholder="Search Customer..."
                  className="text-sm"
                />
              </div>

              <div>
                <label className={labelClass}>Invoice Date</label>
                <input
                  type="date"
                  value={form.invoiceDate}
                  onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })}
                  className={fieldClass}
                />
              </div>

              <div>
                <label className={labelClass}>Due Date</label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className={fieldClass}
                />
              </div>

              <div>
                <label className={labelClass}>Payment Type</label>
                <select
                  value={form.paymentType}
                  onChange={(e) => setForm({ ...form, paymentType: e.target.value })}
                  className={fieldClass}
                >
                  <option value="cash">Cash</option>
                  <option value="credit">Credit</option>
                  <option value="partial">Partial</option>
                </select>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className={labelClass}>Paid Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.paidAmount}
                  disabled={form.paymentType !== 'partial'}
                  onChange={(e) => setForm({ ...form, paidAmount: e.target.value })}
                  className={`${fieldClass} ${form.paymentType !== 'partial' ? 'bg-gray-100 cursor-not-allowed' : ''
                    }`}
                />
              </div>

              <div>
                <label className={labelClass}>Discount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.discount}
                  onChange={(e) => setForm({ ...form, discount: e.target.value })}
                  className={fieldClass}
                />
              </div>

              <div>
                <label className={labelClass}>Tax</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.tax}
                  onChange={(e) => setForm({ ...form, tax: e.target.value })}
                  className={fieldClass}
                />
              </div>

              <div>
                <label className={labelClass}>Transport</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.shipping}
                  onChange={(e) => setForm({ ...form, shipping: e.target.value })}
                  className={fieldClass}
                />
              </div>
            </div>

            <div className="mt-4">
              <label className={labelClass}>Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                className={fieldClass}
              />
            </div>
          </div>

          <div className={cardClass}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Invoice Items</h3>
              <button
                type="button"
                onClick={addItemRow}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Add New
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="border border-gray-200 rounded-md p-3 bg-gray-50">
                  <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-[200px]">
                      <label className={labelClass}>Product</label>
                      <select
                        value={item.stockId}
                        onChange={(e) => handleStockSelect(index, e.target.value)}
                        className={fieldClass}
                      >
                        <option value="">Select Product</option>
                        {stocks.map((stock) => (
                          <option key={stock.id} value={stock.id}>
                            {stock.item_name} (Stock: {stock.quantity})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-[90px]">
                      <label className={labelClass}>Qty</label>
                      <input
                        type="number"
                        value={item.qty}
                        onChange={(e) => updateItem(index, 'qty', e.target.value)}
                        className={fieldClass}
                      />
                    </div>

                    <div className="w-[100px]">
                      <label className={labelClass}>Weight</label>
                      <input
                        type="number"
                        step="0.01"
                        value={item.weight}
                        onChange={(e) => updateItem(index, 'weight', e.target.value)}
                        className={fieldClass}
                      />
                    </div>
                    <div className="w-[100px]">
                      <label className={labelClass}>Unit</label>
                      <select
                        value={item.weight_unit || 'kg'}
                        onChange={(e) => updateItem(index, 'weight_unit', e.target.value)}
                        className={fieldClass}
                      >
                        <option value="g">Gram</option>
                        <option value="kg">Kg</option>
                        <option value="ton">Ton</option>
                      </select>
                    </div>
                    <div className="w-[110px]">
                      <label className={labelClass}>Price</label>
                      <input
                        type="number"
                        value={item.price}
                        onChange={(e) => updateItem(index, 'price', e.target.value)}
                        className={fieldClass}
                      />
                    </div>

                    <div className="w-[120px]">
                      <label className={labelClass}>Amount</label>
                      <input
                        type="number"
                        value={lineAmount(item)}
                        readOnly
                        className={`${fieldClass} bg-gray-100`}
                      />
                    </div>

                    <div className="w-[110px]">
                      <label className={labelClass}>Discount</label>
                      <input
                        type="number"
                        value={item.discount}
                        onChange={(e) => updateItem(index, 'discount', e.target.value)}
                        className={fieldClass}
                      />
                    </div>

                    <div className="w-[90px]">
                      <label className={labelClass}>Tax</label>
                      <input
                        type="number"
                        value={item.tax}
                        onChange={(e) => updateItem(index, 'tax', e.target.value)}
                        className={fieldClass}
                      />
                    </div>

                    <div className="w-[100px]">
                      <label className={labelClass}>&nbsp;</label>
                      {items.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeItemRow(index)}
                          className="w-full border border-red-300 text-red-600 rounded-md px-3 py-2 text-sm hover:bg-red-50"
                        >
                          Remove
                        </button>
                      ) : (
                        <div className="h-[38px]" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[150px] border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 shadow-sm">
              <p className="text-xs text-gray-500">Subtotal</p>
              <p className="text-lg font-semibold text-gray-900">Rs {money(totals.subtotal)}</p>
            </div>

            <div className="flex-1 min-w-[150px] border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 shadow-sm">
              <p className="text-xs text-gray-500">Discount</p>
              <p className="text-lg font-semibold text-gray-900">Rs {money(totals.itemDiscount)}</p>
            </div>

            <div className="flex-1 min-w-[150px] border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 shadow-sm">
              <p className="text-xs text-gray-500">Tax</p>
              <p className="text-lg font-semibold text-gray-900">Rs {money(totals.itemTax)}</p>
            </div>

            <div className="flex-1 min-w-[160px] border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 shadow-sm">
              <p className="text-xs text-indigo-600 font-medium">Total</p>
              <p className="text-xl font-bold text-indigo-700">Rs {money(totals.total)}</p>
            </div>
          </div>

          <div className="flex flex-row gap-3 sm:flex-row sm:items-center">
            <button
              type="submit"
              disabled={loading}
              className="border border-green-600 text-white bg-green-600 rounded-md px-3 py-2 text-sm"
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
              className="border border-gray-300 text-gray-700 rounded-md px-3 py-2 text-sm hover:bg-gray-50"
            >
              Reset Form
            </button>
          </div>
        </form>
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
