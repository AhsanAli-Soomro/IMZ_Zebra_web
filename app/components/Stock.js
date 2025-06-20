'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'

export default function Stocks() {
  const [stocks, setStocks] = useState([])
  const [form, setForm] = useState({
    id: null,
    item_code: '',
    item_name: '',
    category: '',
    quantity: '',
    purchase_price: '',
    selling_price: '',
    supplier_name: '',
    purchase_date: '',
    status: 'Active',
    existing_image: ''
  })

  const [imageFile, setImageFile] = useState(null)
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers] = useState([])

  const fetchStocks = async () => {
    const res = await axios.get('/api/stocks')
    setStocks(res.data.data)
  }

  const fetchCategories = async () => {
    const res = await axios.get('/api/categories')
    setCategories(res.data.data.filter(c => c.status === 'Active'))
  }

  const fetchSuppliers = async () => {
    const res = await axios.get('/api/suppliers')
    setSuppliers(res.data.data.filter(s => s.status === 'Active'))
  }

  useEffect(() => {
    fetchStocks()
    fetchCategories()
    fetchSuppliers()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const formData = new FormData()

    for (const key in form) {
      formData.append(key, form[key])
    }

    if (imageFile) {
      formData.append('image', imageFile)
    }

    if (form.id) {
      await axios.put('/api/stocks', formData)
    } else {
      await axios.post('/api/stocks', formData)
    }

    setForm({
      id: null, item_code: '', item_name: '', category: '', quantity: '',
      purchase_price: '', selling_price: '', supplier_name: '',
      purchase_date: '', status: 'Active', existing_image: ''
    })
    setImageFile(null)
    fetchStocks()
  }

  const handleEdit = (stock) => {
    setForm({
      id: stock.id,
      item_code: stock.item_code,
      item_name: stock.item_name,
      category: stock.category,
      quantity: stock.quantity,
      purchase_price: stock.purchase_price,
      selling_price: stock.selling_price,
      supplier_name: stock.supplier_name,
      purchase_date: stock.purchase_date ? stock.purchase_date.slice(0, 10) : '',
      status: stock.status,
      existing_image: stock.image_path || ''
    })
    setImageFile(null)
  }

  const handleDelete = async (id) => {
    await axios.delete('/api/stocks', { data: { id } })
    fetchStocks()
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Stock Management</h1>

      <form onSubmit={handleSubmit} encType="multipart/form-data" className="grid grid-cols-4 gap-4 mb-6">

        <input type="hidden" name="existing_image" value={form.existing_image} />

        <div>
          <label className="block text-sm font-medium mb-1">Item Code</label>
          <input
            value={form.item_code}
            onChange={(e) => setForm({ ...form, item_code: e.target.value })}
            required
            className="border p-2 w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Item Name</label>
          <input
            value={form.item_name}
            onChange={(e) => setForm({ ...form, item_name: e.target.value })}
            required
            className="border p-2 w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Category</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="border p-2 w-full"
            required
          >
            <option value="">Select Category</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.name}>{cat.name}</option>
            ))}
          </select>
        </div>


        <div>
          <label className="block text-sm font-medium mb-1">Quantity</label>
          <input
            type="number"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            required
            className="border p-2 w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Purchase Price (PKR)</label>
          <input
            type="number"
            value={form.purchase_price}
            onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
            required
            className="border p-2 w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Selling Price (PKR)</label>
          <input
            type="number"
            value={form.selling_price}
            onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
            required
            className="border p-2 w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Supplier</label>
          <select
            value={form.supplier_name}
            onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
            className="border p-2 w-full"
          >
            <option value="">Select Supplier</option>
            {suppliers.map(sup => (
              <option key={sup.id} value={sup.name}>
                {sup.name} {sup.company_name ? `(${sup.company_name})` : ''}
              </option>
            ))}
          </select>
        </div>


        <div>
          <label className="block text-sm font-medium mb-1">Purchase Date</label>
          <input
            type="date"
            value={form.purchase_date}
            onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
            className="border p-2 w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="border p-2 w-full"
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Item Image</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files[0])}
            className="border p-2 w-full"
          />
        </div>

        <div className="col-span-1">
          <button
            type="submit"
            className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
          >
            {form.id ? 'Update Stock' : 'Add Stock'}
          </button>
        </div>
      </form>

      <table className="w-full border">
        <thead>
          <tr className="bg-gray-200 text-left">
            <th className="border px-2 py-1">Image</th>
            <th className="border px-2 py-1">Code</th>
            <th className="border px-2 py-1">Name</th>
            <th className="border px-2 py-1">Category</th>
            <th className="border px-2 py-1">Qty</th>
            <th className="border px-2 py-1">Purchase</th>
            <th className="border px-2 py-1">Selling</th>
            <th className="border px-2 py-1">Status</th>
            <th className="border px-2 py-1">Actions</th>
          </tr>
        </thead>
        <tbody>
          {stocks.map(stock => (
            <tr key={stock.id}>
              <td className="border px-2 py-1">
                {stock.image_path ? (
                  <img src={stock.image_path} alt="Item" className="h-10 w-10 object-cover" />
                ) : (
                  'No Image'
                )}
              </td>
              <td className="border px-2 py-1">{stock.item_code}</td>
              <td className="border px-2 py-1">{stock.item_name}</td>
              <td className="border px-2 py-1">{stock.category}</td>
              <td className="border px-2 py-1">{stock.quantity}</td>
              <td className="border px-2 py-1">{stock.purchase_price}</td>
              <td className="border px-2 py-1">{stock.selling_price}</td>
              <td className="border px-2 py-1">{stock.status}</td>
              <td className="border px-2 py-1 space-x-2">
                <button onClick={() => handleEdit(stock)} className="text-blue-600">Edit</button>
                <button onClick={() => handleDelete(stock.id)} className="text-red-600">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
