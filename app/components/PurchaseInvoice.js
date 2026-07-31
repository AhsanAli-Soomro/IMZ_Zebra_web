'use client'

import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import Select from "react-select";
import InvoicePreviewModal from './InvoicePreviewModal'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function money(value) {
  return Number(value || 0).toLocaleString()
}

function lineAmount(item) {
  const qty = Number(item.qty || 0)
  const weight = Number(item.weight || 0)
  const price = Number(item.price || 0)

  return qty * weight * price
}

export default function PurchaseInvoice() {
  const [suppliers, setSuppliers] = useState([])
  const [stocks, setStocks] = useState([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false)
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [invoiceDetail, setInvoiceDetail] = useState(null)
  const [company, setCompany] = useState(null)

  const [form, setForm] = useState({
    supplierId: '',
    supplierName: '',
    brokerName: '',
    warehouseName: '',
    invoiceType: 'purchase',
    purchaseDate: today(),
    transportExpense: '',
    notes: '',
    paymentType: 'cash',
    paidAmount: '',
  })

  const emptyItem = () => ({
    stockId: '',
    itemCode: '',
    itemName: '',
    qty: 1,
    weight: '',
    weight_unit: 'kg',
    price: '',
    amount: '',
    discount: 0,
    tax: 0,
  })

  const [items, setItems] = useState([emptyItem()])

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + lineAmount(item), 0)
    const discount = items.reduce((sum, item) => sum + Number(item.discount || 0), 0)
    const tax = items.reduce((sum, item) => sum + Number(item.tax || 0), 0)
    const transport = Number(form.transportExpense || 0)
    const total = subtotal - discount + tax + transport

    return { subtotal, discount, tax, transport, total }
  }, [items, form.transportExpense])

  useEffect(() => {
    async function loadCompany() {
      try {
        const res = await fetch('/api/company-profile')
        const data = await res.json()
        setCompany(data)
      } catch (err) {
        console.error('Company load failed', err)
      }
    }

    loadCompany()
  }, [])

  async function loadStocks() {
    return fetch('/api/stocks', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => setStocks(data?.data || []))
      .catch((err) => console.error('Products load failed', err))
  }

  useEffect(() => {
    loadStocks()
  }, [])

  useEffect(() => {
    async function loadSuppliers() {
      try {
        const res = await axios.get('/api/suppliers')
        setSuppliers((res.data?.data || []).filter((s) => s.status === 'Active'))
      } catch (err) {
        console.error('Suppliers load failed', err)
      }
    }

    loadSuppliers()
  }, [])

  async function openInvoiceModal(invoiceId) {
    try {
      setInvoiceModalOpen(true)
      setInvoiceLoading(true)
      setInvoiceDetail(null)

      const res = await fetch(`/api/purchase-invoices/${invoiceId}`, {
        cache: 'no-store',
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to load purchase invoice')
      }

      setInvoiceDetail(data.data)
    } catch (error) {
      setMessage(error.message || 'Failed to load purchase invoice')
      setInvoiceModalOpen(false)
    } finally {
      setInvoiceLoading(false)
    }
  }

  function closeInvoiceModal() {
    setInvoiceModalOpen(false)
    setInvoiceDetail(null)
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

  function addItem() {
    setItems((prev) => [...prev, emptyItem()])
  }

  function removeItem(index) {
    setItems((prev) => {
      const updated = prev.filter((_, i) => i !== index)
      return updated.length ? updated : [emptyItem()]
    })
  }

  function resetForm() {
    setForm({
      supplierId: '',
      supplierName: '',
      brokerName: '',
      warehouseName: '',
      invoiceType: 'purchase',
      purchaseDate: today(),
      transportExpense: '',
      notes: '',
      paymentType: 'cash',
      paidAmount: '',
    })

    setItems([emptyItem()])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const validItems = items.filter((item) => item.itemName.trim())

      if (!form.supplierName.trim()) {
        throw new Error('Supplier required hai')
      }

      if (!validItems.length) {
        throw new Error('Kam az kam 1 item required hai')
      }

      const payload = {
        supplierId: form.supplierId ? Number(form.supplierId) : null,
        supplierName: form.supplierName,
        brokerName: form.brokerName,
        warehouseName: form.warehouseName,
        invoiceType: form.invoiceType,
        purchaseDate: form.purchaseDate,

        paymentType: form.paymentType,

        paidAmount:
          form.paymentType === 'cash'
            ? totals.total
            : form.paymentType === 'credit'
              ? 0
              : Number(form.paidAmount || 0),

        transportExpense: Number(form.transportExpense || 0),
        notes: form.notes,

        items: validItems.map((item) => {
          const qty = Number(item.qty || 0)
          const weight = Number(item.weight || 0)
          const price = Number(item.price || 0)
          const amount = lineAmount(item)

          return {
            stockId: item.stockId ? Number(item.stockId) : null,
            itemCode: item.itemCode,
            itemName: item.itemName,
            item_name: item.itemName,
            qty,
            weight,
            weight_unit: item.weight_unit || 'kg',
            price,
            cost_price: price,
            amount,
            discount: Number(item.discount || 0),
            tax: Number(item.tax || 0),
          }
        }),
      }

      const res = await fetch('/api/purchase-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || 'Purchase invoice save failed')
      }
      setMessage(`Purchase invoice saved: ${data.data?.purchase_no || ''}`)
      await loadStocks()
      resetForm()

      if (data.data?.id) {
        await openInvoiceModal(data.data.id)
      }
    } catch (err) {
      setMessage(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-xl shadow border p-5 mb-5">
        <h1 className="text-2xl font-bold text-indigo-700">Purchase Invoice</h1>
        <p className="text-sm text-gray-500 mt-1">
          Purchase invoice save karein aur stock automatically add/update hoga.
        </p>
      </div>

      {/* {message && (
        <div className="mb-4 border border-indigo-200 bg-indigo-50 text-indigo-800 rounded-lg px-4 py-3 text-sm">
          {message}
        </div>
      )} */}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-white rounded-xl shadow border p-5">
          <h2 className="font-semibold text-lg mb-4">Invoice Details</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Supplier</label>

              <Select
                options={suppliers.map((sup) => ({
                  value: sup.id,
                  label: `${sup.name}${sup.company_name ? ` (${sup.company_name})` : ""
                    }`,
                  searchText: `
                  ${sup.name || ""}
                  ${sup.company_name || ""}
                  ${sup.first_name || ""}
                  ${sup.middle_name || ""}
                  ${sup.last_name || ""}
                `.toLowerCase(),
                }))}
                value={
                  form.supplierId
                    ? suppliers
                      .map((sup) => ({
                        value: sup.id,
                        label: `${sup.name}${sup.company_name ? ` (${sup.company_name})` : ""
                          }`,
                      }))
                      .find((option) => String(option.value) === String(form.supplierId))
                    : null
                }
                onChange={(selected) =>
                  {
                    const supplier = suppliers.find(
                      (item) => String(item.id) === String(selected?.value)
                    )

                    setForm({
                      ...form,
                      supplierId: selected?.value ? String(selected.value) : '',
                      supplierName: supplier?.name || '',
                    })
                  }
                }
                isSearchable
                placeholder="Search Supplier..."
                // className="border rounded-md px-3 py-2 w-full"
                styles={{
                  control: (provided) => ({
                    ...provided,
                    border: '1px solid black',
                    borderRadius: '8px',
                    padding: '2px',
                    width: '100%',
                  }),
                  input: (provided) => ({
                    ...provided,
                    border: 'none',
                    outline: 'none',
                    padding: '0',
                  }),
                  option: (provided, state) => ({
                    ...provided,
                    backgroundColor: state.isSelected ? '#007BFF' : 'transparent',
                    color: state.isSelected ? '#fff' : '#333',
                    padding: '8px',
                  })
                }}
                filterOption={(option, inputValue) =>
                  option.data.searchText.includes(inputValue.toLowerCase())
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Broker Name</label>
              <input
                value={form.brokerName}
                onChange={(e) => setForm({ ...form, brokerName: e.target.value })}
                className="border rounded-md px-3 py-2 w-full"
                placeholder="Broker name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Warehouse Name</label>
              <input
                value={form.warehouseName}
                onChange={(e) => setForm({ ...form, warehouseName: e.target.value })}
                className="border rounded-md px-3 py-2 w-full"
                placeholder="Warehouse / delivery place"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Sale / Purchase Type</label>
              <select
                value={form.invoiceType}
                onChange={(e) => setForm({ ...form, invoiceType: e.target.value })}
                className="border rounded-md px-3 py-2 h-11 w-full"
              >
                <option value="purchase">Purchase</option>
                <option value="sale">Sale</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Purchase Date</label>
              <input
                type="date"
                value={form.purchaseDate}
                onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
                className="border rounded-md px-3 py-2 w-full"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Payment Type</label>

              <select
                value={form.paymentType}
                onChange={(e) =>
                  setForm({
                    ...form,
                    paymentType: e.target.value,
                  })
                }
                className="border rounded px-3 py-2 w-full"
              >
                <option value="cash">Cash</option>
                <option value="credit">Credit</option>
                <option value="partial">Partial</option>
              </select>
            </div>
            {form.paymentType === 'partial' && (
              <div>
                <label className="block text-sm mb-1">
                  Paid Amount
                </label>

                <input
                  type="number"
                  value={form.paidAmount}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      paidAmount: e.target.value,
                    })
                  }
                  className="border rounded px-3 py-2 w-full"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">Transport Expense</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.transportExpense}
                onChange={(e) => setForm({ ...form, transportExpense: e.target.value })}
                className="border rounded-md px-3 py-2 w-full"
                placeholder="0"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="border rounded-md px-3 py-2 w-full"
              rows={3}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow border p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-lg">Items</h2>

            <button
              type="button"
              onClick={addItem}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-md px-4 py-2 text-sm"
            >
              Add Item to List
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="border rounded-lg p-3 bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-10 gap-3 items-end">
                  <div>
                    <label className="block text-sm font-medium mb-1">Item Code</label>
                    <input
                      value={item.itemCode}
                      onChange={(e) => updateItem(index, 'itemCode', e.target.value)}
                      className="border rounded-md px-3 py-2 w-full"
                      placeholder="Manual code"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Item Name / Product List</label>
                    <input
                      list={`product-list-${index}`}
                      value={item.itemName}
                      onChange={(e) => {
                        const value = e.target.value
                        const selected = stocks.find(
                          (stock) => String(stock.item_name).toLowerCase() === value.toLowerCase()
                        )
                        setItems((prev) => prev.map((row, i) => i === index ? {
                          ...row,
                          itemName: value,
                          stockId: selected?.id || '',
                          itemCode: selected?.item_code || (row.stockId ? '' : row.itemCode),
                          weight_unit: selected?.weight_unit || row.weight_unit,
                          price:
                            selected?.purchase_rate ||
                            selected?.purchase_price ||
                            row.price,
                        } : row))
                      }}
                      className="border rounded-md px-3 py-2 w-full"
                      placeholder="List se select ya new name likhein"
                    />
                    <datalist id={`product-list-${index}`}>
                      {stocks.map((stock) => (
                        <option key={stock.id} value={stock.item_name}>
                          {stock.item_code} — {stock.item_name} — Current Stock:{' '}
                          {Number(stock.quantity ?? stock.qty ?? 0).toLocaleString()}
                        </option>
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Qty</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.qty}
                      onChange={(e) => updateItem(index, 'qty', e.target.value)}
                      className="border rounded-md px-3 py-2 w-full"
                    />
                    {item.stockId && (
                      <p className="mt-1 text-xs font-medium text-green-700">
                        Current:{' '}
                        {Number(
                          stocks.find(
                            (stock) => String(stock.id) === String(item.stockId)
                          )?.quantity || 0
                        ).toLocaleString()}{' '}
                        → After purchase:{' '}
                        {(
                          Number(
                            stocks.find(
                              (stock) => String(stock.id) === String(item.stockId)
                            )?.quantity || 0
                          ) + Number(item.qty || 0)
                        ).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Weight</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.weight}
                      onChange={(e) => updateItem(index, 'weight', e.target.value)}
                      className="border rounded-md px-3 py-2 w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Unit</label>
                    <select
                      value={item.weight_unit || 'kg'}
                      onChange={(e) => updateItem(index, 'weight_unit', e.target.value)}
                      className="border rounded-md px-3 py-2 w-full"
                    >
                      <option value="g">Gram</option>
                      <option value="kg">Kg</option>
                      <option value="ton">Ton</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Rate / Kg</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.price}
                      onChange={(e) => updateItem(index, 'price', e.target.value)}
                      className="border rounded-md px-3 py-2 w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Purchase Price</label>
                    <input
                      type="number"
                      value={lineAmount(item)}
                      readOnly
                      className="border rounded-md px-3 py-2 w-full bg-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Discount</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.discount}
                      onChange={(e) => updateItem(index, 'discount', e.target.value)}
                      className="border rounded-md px-3 py-2 w-full"
                    />
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="border border-red-300 text-red-600 hover:bg-red-50 rounded-md px-3 py-2 w-full"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow border p-5">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-sm">
            <div className="border rounded-lg p-3 bg-gray-50">
              <p className="text-gray-500">Subtotal</p>
              <p className="font-bold">Rs {money(totals.subtotal)}</p>
            </div>

            <div className="border rounded-lg p-3 bg-gray-50">
              <p className="text-gray-500">Discount</p>
              <p className="font-bold">Rs {money(totals.discount)}</p>
            </div>

            <div className="border rounded-lg p-3 bg-gray-50">
              <p className="text-gray-500">Tax</p>
              <p className="font-bold">Rs {money(totals.tax)}</p>
            </div>

            <div className="border rounded-lg p-3 bg-gray-50">
              <p className="text-gray-500">Transport</p>
              <p className="font-bold">Rs {money(totals.transport)}</p>
            </div>

            <div className="border rounded-lg p-3 bg-indigo-50">
              <p className="text-indigo-600">Total</p>
              <p className="font-bold text-indigo-700">Rs {money(totals.total)}</p>
            </div>
          </div>

          <div className="mt-5 flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 text-white rounded-md px-5 py-2"
            >
              {loading ? 'Saving...' : 'Save Purchase Invoice List'}
            </button>

            <button
              type="button"
              onClick={resetForm}
              className="bg-gray-600 hover:bg-gray-700 text-white rounded-md px-5 py-2"
            >
              Reset
            </button>
          </div>
        </div>
      </form>
      {invoiceModalOpen && (
        <InvoicePreviewModal
          open={invoiceModalOpen}
          onClose={closeInvoiceModal}
          invoice={invoiceLoading ? null : invoiceDetail}
          company={company}
          title={invoiceDetail?.purchase_no || 'Purchase Invoice'}
          message={message}
          setMessage={setMessage}
        />
      )}
    </div>
  )
}
