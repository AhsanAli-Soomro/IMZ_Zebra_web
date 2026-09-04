'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'

function stockTotal(quantity, weight, rate) {
  return Number(quantity || 0) * Number(weight || 0) * Number(rate || 0)
}

export default function Stocks() {
  const [stocks, setStocks] = useState([])
  const [form, setForm] = useState({
    id: null,
    item_code: '',
    item_name: '',
    category: '',
    quantity: '',
    weight: '',
    weight_unit: 'kg',
    purchase_rate: '',
    purchase_price: '',
    selling_rate: '',
    selling_price: '',
    expire_date: '',
    supplier_name: '',
    purchase_date: '',
    status: 'Active',
    existing_image: '',
  })

  const [imageFile, setImageFile] = useState(null)
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [searchCategory, setSearchCategory] = useState('')
  const [searchSupplier, setSearchSupplier] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalStocks, setTotalStocks] = useState(0)
  const [saving, setSaving] = useState(false)
  const [pendingStocks, setPendingStocks] = useState([])
  const [notice, setNotice] = useState({ type: '', text: '' })

  const itemsPerPage = 10

  const paginatedStocks = stocks

  const fetchStocks = async () => {
    const params = { paginate: 1, page: currentPage, limit: itemsPerPage }
    if (searchTerm.trim()) params.search = searchTerm.trim()
    if (searchCategory) params.category = searchCategory
    if (searchSupplier) params.supplier = searchSupplier
    const res = await axios.get('/api/stocks', { params })
    setStocks(res.data.data || [])
    setTotalPages(res.data.pagination?.totalPages || 1)
    setTotalStocks(res.data.pagination?.total || 0)
  }

  const fetchCategories = async () => {
    const res = await axios.get('/api/categories')
    setCategories((res.data.data || []).filter((c) => c.status === 'Active'))
  }

  const fetchSuppliers = async () => {
    const res = await axios.get('/api/suppliers')
    setSuppliers((res.data.data || []).filter((s) => s.status === 'Active'))
  }

  useEffect(() => {
    fetchCategories()
    fetchSuppliers()
  }, [])

  useEffect(() => {
    const timer = setTimeout(fetchStocks, 250)
    return () => clearTimeout(timer)
  }, [currentPage, searchTerm, searchCategory, searchSupplier])

  const resetForm = () => {
    setForm({
      id: null,
      item_code: '',
      item_name: '',
      category: '',
      quantity: '',
      weight: '',
      weight_unit: 'kg',
      purchase_rate: '',
      purchase_price: '',
      selling_rate: '',
      selling_price: '',
      expire_date: '',
      supplier_name: '',
      purchase_date: '',
      status: 'Active',
      existing_image: '',
    })

    setImageFile(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    setNotice({ type: '', text: '' })

    try {
      if (!form.id) {
        setPendingStocks((items) => [
          ...items,
          {
            key: `pending-${Date.now()}-${items.length}`,
            data: { ...form },
            imageFile,
          },
        ])
        resetForm()
        return
      }

      setSaving(true)
      const formData = new FormData()

      for (const key in form) {
        formData.append(key, form[key])
      }

      if (imageFile) {
        formData.append('image', imageFile)
      }

      const response = await axios.put('/api/stocks', formData)

      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Product could not be saved.')
      }

      resetForm()
      await fetchStocks()
      setNotice({
        type: 'success',
        text: 'Product successfully update ho gaya.',
      })
    } catch (error) {
      setNotice({
        type: 'error',
        text:
          error.response?.data?.message ||
          error.message ||
          'Product could not be saved. Please try again.',
      })
    } finally {
      setSaving(false)
    }
  }

  const saveStockList = async () => {
    if (!pendingStocks.length) return
    setSaving(true)
    setNotice({ type: '', text: '' })
    try {
      for (const pending of pendingStocks) {
        const formData = new FormData()
        Object.entries(pending.data).forEach(([key, value]) => formData.append(key, value))
        if (pending.imageFile) formData.append('image', pending.imageFile)

        const response = await axios.post('/api/stocks', formData)
        if (!response.data?.success) throw new Error(response.data?.message || 'Stock save failed')
      }
      const count = pendingStocks.length
      setPendingStocks([])
      await fetchStocks()
      setNotice({ type: 'success', text: `${count} products ki list successfully save ho gayi.` })
    } catch (error) {
      setNotice({
        type: 'error',
        text: error.response?.data?.message || error.message || 'Stock list could not be saved.',
      })
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''

    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return ''

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
  }

  const handleEdit = (stock) => {
    setForm({
      id: stock.id,
      item_code: stock.item_code || '',
      item_name: stock.item_name || '',
      category: stock.category || '',
      quantity: stock.quantity || '',
      weight: stock.weight || '',
      weight_unit: stock.weight_unit || 'kg',
      purchase_rate:
        stock.purchase_rate ||
        (Number(stock.quantity || 0) * Number(stock.weight || 0) > 0
          ? Number(stock.purchase_price || 0) /
            (Number(stock.quantity) * Number(stock.weight))
          : ''),
      purchase_price: stock.purchase_price || '',
      selling_rate:
        stock.selling_rate ||
        (Number(stock.quantity || 0) * Number(stock.weight || 0) > 0
          ? Number(stock.selling_price || 0) /
            (Number(stock.quantity) * Number(stock.weight))
          : ''),
      selling_price: stock.selling_price || '',
      expire_date: stock.expire_date ? formatDate(stock.expire_date) : '',
      supplier_name: stock.supplier_name || '',
      purchase_date: stock.purchase_date ? formatDate(stock.purchase_date) : '',
      status: stock.status || 'Active',
      existing_image: stock.image_path || '',
    })

    setImageFile(null)
  }

  const handleDelete = async (id) => {
    await axios.delete('/api/stocks', { data: { id } })
    fetchStocks()
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold text-indigo-700 mb-6">📦 Stock Management</h1>

      <form
        onSubmit={handleSubmit}
        encType="multipart/form-data"
        className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-6 rounded-lg shadow mb-4"
      >
        {notice.text ? (
          <div
            className={`md:col-span-4 rounded-md px-4 py-3 text-sm ${
              notice.type === 'error'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-green-50 text-green-700 border border-green-200'
            }`}
          >
            {notice.text}
          </div>
        ) : null}
        <input type="hidden" name="existing_image" value={form.existing_image} />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Item Code</label>
          <input
            list="existing-item-codes"
            value={form.item_code}
            onChange={(e) => setForm({ ...form, item_code: e.target.value })}
            required
            className="border border-gray-300 p-2 rounded-md w-full"
            placeholder="New code manually likhein"
          />
          <datalist id="existing-item-codes">
            {stocks.map((stock) => (
              <option key={stock.id} value={stock.item_code}>{stock.item_name}</option>
            ))}
          </datalist>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
          <input
            list="existing-item-names"
            value={form.item_name}
            onChange={(e) => setForm({ ...form, item_name: e.target.value })}
            required
            className="border border-gray-300 p-2 rounded-md w-full"
            placeholder="List se dekhein ya new name likhein"
          />
          <datalist id="existing-item-names">
            {stocks.map((stock) => (
              <option key={stock.id} value={stock.item_name}>{stock.item_code}</option>
            ))}
          </datalist>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            // required
            className="border border-gray-300 p-2 rounded-md w-full"
          >
            <option value="">Select Category</option>
            {categories.map((cat, index) => (
              <option key={cat.id || index} value={cat.name}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
          <input
            type="number"
            value={form.quantity}
            onChange={(e) => {
              const quantity = e.target.value
              setForm({
                ...form,
                quantity,
                purchase_price: stockTotal(quantity, form.weight, form.purchase_rate),
                selling_price: stockTotal(quantity, form.weight, form.selling_rate),
              })
            }}
            required
            className="border border-gray-300 p-2 rounded-md w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Weight</label>
          <input
            type="number"
            step="0.01"
            value={form.weight}
            onChange={(e) => {
              const weight = e.target.value
              setForm({
                ...form,
                weight,
                purchase_price: stockTotal(form.quantity, weight, form.purchase_rate),
                selling_price: stockTotal(form.quantity, weight, form.selling_rate),
              })
            }}
            className="border border-gray-300 p-2 rounded-md w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Weight Unit</label>
          <select
            value={form.weight_unit}
            onChange={(e) => setForm({ ...form, weight_unit: e.target.value })}
            className="border border-gray-300 p-2 rounded-md w-full"
          >
            <option value="g">Gram</option>
            <option value="kg">Kg</option>
            <option value="ton">Ton</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rate Per Kg (PKR)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.purchase_rate}
            onChange={(e) => {
              const purchase_rate = e.target.value
              setForm({
                ...form,
                purchase_rate,
                purchase_price: stockTotal(form.quantity, form.weight, purchase_rate),
              })
            }}
            required
            className="border border-gray-300 p-2 rounded-md w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Total Purchase Price (Qty × Weight × Rate)
          </label>
          <input
            type="number"
            value={form.purchase_price}
            readOnly
            className="border border-gray-300 bg-gray-100 p-2 rounded-md w-full font-semibold"
          />
          <p className="mt-1 text-xs text-gray-500">
            {Number(form.quantity || 0).toLocaleString()} ×{' '}
            {Number(form.weight || 0).toLocaleString()} kg × Rs{' '}
            {Number(form.purchase_rate || 0).toLocaleString()}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Selling Rate Per Kg (PKR)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.selling_rate}
            onChange={(e) => {
              const selling_rate = e.target.value
              setForm({
                ...form,
                selling_rate,
                selling_price: stockTotal(form.quantity, form.weight, selling_rate),
              })
            }}
            className="border border-gray-300 p-2 rounded-md w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Total Selling Price (Qty × Weight × Rate)
          </label>
          <input
            type="number"
            value={form.selling_price}
            readOnly
            className="border border-gray-300 bg-gray-100 p-2 rounded-md w-full font-semibold"
          />
          <p className="mt-1 text-xs text-gray-500">
            {Number(form.quantity || 0).toLocaleString()} ×{' '}
            {Number(form.weight || 0).toLocaleString()} kg × Rs{' '}
            {Number(form.selling_rate || 0).toLocaleString()}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Expire Date</label>
          <input
            type="date"
            value={form.expire_date}
            onChange={(e) => setForm({ ...form, expire_date: e.target.value })}
            className="border border-gray-300 p-2 rounded-md w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
          <select
            value={form.supplier_name}
            onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
            className="border border-gray-300 p-2 rounded-md w-full"
          >
            <option value="">Select Supplier</option>
            {suppliers.map((sup, index) => (
              <option key={sup.id || index} value={sup.name}>
                {sup.name} {sup.company_name ? `(${sup.company_name})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
          <input
            type="date"
            value={form.purchase_date}
            onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
            className="border border-gray-300 p-2 rounded-md w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="border border-gray-300 p-2 rounded-md w-full"
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Item Image</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            className="file:mr-4 file:py-1 file:px-2 file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 cursor-pointer"
          />
        </div>

        <div className="col-span-1 md:col-span-2 lg:col-span-1 flex items-end">
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2 rounded-md shadow"
          >
            {saving ? 'Saving...' : form.id ? 'Update Stock' : 'Add to List'}
          </button>
        </div>
      </form>

      {!form.id && (
        <div className="bg-white border rounded-lg shadow mb-4 p-4 grid lg:grid-cols-[1fr_auto] gap-3 items-start">
          <div>
            <h2 className="font-semibold">Pending Stock List ({pendingStocks.length})</h2>
            <div className="mt-2 divide-y border rounded-lg">
              {pendingStocks.length ? pendingStocks.map((pending, index) => (
                <div key={pending.key} className="flex justify-between gap-3 p-3 text-sm">
                  <span>
                    {index + 1}. {pending.data.item_code} — {pending.data.item_name}
                    {' '}({Number(pending.data.weight || 0).toLocaleString()} kg)
                  </span>
                  <button type="button" onClick={() => setPendingStocks((rows) => rows.filter((row) => row.key !== pending.key))} className="text-red-600">Remove</button>
                </div>
              )) : <p className="p-3 text-sm text-gray-500">Stock form fill karke Add to List karein.</p>}
            </div>
          </div>
          <button type="button" onClick={saveStockList} disabled={!pendingStocks.length || saving} className="bg-green-600 disabled:bg-gray-400 text-white font-semibold rounded-lg px-5 py-2">
            Save Stock List
          </button>
        </div>
      )}

      <div className="overflow-x-auto bg-white p-4 rounded-lg shadow-lg">
        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Search by name or code"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1)
            }}
            className="border p-2 rounded-md w-full"
          />

          <select
            value={searchCategory}
            onChange={(e) => {
              setSearchCategory(e.target.value)
              setCurrentPage(1)
            }}
            className="border p-2 rounded-md w-full"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.name}>
                {cat.name}
              </option>
            ))}
          </select>

          <select
            value={searchSupplier}
            onChange={(e) => {
              setSearchSupplier(e.target.value)
              setCurrentPage(1)
            }}
            className="border p-2 rounded-md w-full"
          >
            <option value="">All Suppliers</option>
            {suppliers.map((sup) => (
              <option key={sup.id} value={sup.name}>
                {sup.name}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-auto rounded-md border border-gray-200">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-indigo-600 text-white">
              <tr>
                <th className="p-3">Image</th>
                <th className="p-3">Code</th>
                <th className="p-3">Name</th>
                <th className="p-3">Category</th>
                <th className="p-3">Qty</th>
                <th className="p-3">Weight</th>
                <th className="p-3">Unit</th>
                <th className="p-3">Supplier</th>
                <th className="p-3">Purchase</th>
                <th className="p-3">Selling</th>
                <th className="p-3">Profit / Loss</th>
                <th className="p-3">Expire Date</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>

            <tbody>
              {paginatedStocks.map((stock, i) => (
                <tr
                  key={stock.id}
                  className={`hover:bg-indigo-50 transition duration-200 ${
                    i % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  }`}
                >
                  <td className="p-3">
                    {stock.image_path ? (
                      <img
                        src={stock.image_path}
                        alt="Item"
                        className="h-10 w-10 rounded object-cover border"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : (
                      <span className="text-gray-400">No Image</span>
                    )}
                  </td>

                  <td className="p-3">{stock.item_code}</td>
                  <td className="p-3 font-medium">{stock.item_name}</td>
                  <td className="p-3">{stock.category}</td>
                  <td className="p-3">{stock.quantity}</td>
                  <td className="p-3">{Number(stock.weight || 0).toLocaleString()}</td>
                  <td className="p-3">{stock.weight_unit || 'kg'}</td>
                  <td className="p-3">{stock.supplier_name || '-'}</td>

                  <td className="p-3 text-blue-700 font-semibold">
                    <div>Rs {Number(stock.purchase_price || 0).toLocaleString()}</div>
                    <div className="text-xs font-normal text-gray-500">
                      Rate: Rs {Number(stock.purchase_rate || 0).toLocaleString()} / kg
                    </div>
                  </td>

                  <td className="p-3 text-blue-700 font-semibold">
                    <div>Rs {Number(stock.selling_price || 0).toLocaleString()}</div>
                    <div className="text-xs font-normal text-gray-500">
                      Rate: Rs {Number(stock.selling_rate || 0).toLocaleString()} / kg
                    </div>
                  </td>

                  <td className={`p-3 font-semibold ${
                    Number(stock.profit_loss || 0) >= 0 ? 'text-green-700' : 'text-red-700'
                  }`}>
                    <div>
                      {Number(stock.profit_loss || 0) >= 0 ? 'Profit' : 'Loss'}: Rs{' '}
                      {Math.abs(Number(stock.profit_loss || 0)).toLocaleString()}
                    </div>
                    <div className="text-xs font-normal text-gray-500">
                      Sale Rs {Number(stock.sales_amount || 0).toLocaleString()} · Cost Rs{' '}
                      {Number(stock.cost_amount || 0).toLocaleString()}
                    </div>
                  </td>

                  <td className="p-3">
                    {stock.expire_date ? new Date(stock.expire_date).toLocaleDateString() : '-'}
                  </td>

                  <td
                    className={`p-3 font-semibold ${
                      stock.status === 'Active' ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {stock.status}
                  </td>

                  <td className="p-3 text-center space-x-2">
                    <button
                      onClick={() => handleEdit(stock)}
                      className="text-indigo-600 hover:underline"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => handleDelete(stock.id)}
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {!paginatedStocks.length && (
                <tr>
                  <td colSpan={14} className="p-6 text-center text-gray-500">
                    No stock found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center mt-6 text-sm text-gray-600">
          <p>
            Showing {totalStocks ? (currentPage - 1) * itemsPerPage + 1 : 0}–
            {Math.min(currentPage * itemsPerPage, totalStocks)} of{' '}
            {totalStocks}
          </p>

          <div className="space-x-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50"
            >
              Prev
            </button>

            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-4 py-2 rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
