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
    expire_date: '',
    supplier_name: '',
    purchase_date: '',
    status: 'Active',
    existing_image: ''
  })

  const [imageFile, setImageFile] = useState(null)
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [searchTerm, setSearchTerm] = useState('');
  const [searchCategory, setSearchCategory] = useState('');
  const [searchSupplier, setSearchSupplier] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredStocks = stocks.filter(stock => {
    const itemCode = String(stock.item_code || '').toLowerCase();
    const itemName = String(stock.item_name || '').toLowerCase();
    const matchesCode = itemCode.includes(searchTerm.toLowerCase());
    const matchesName = itemName.includes(searchTerm.toLowerCase());
    const matchesCategory = searchCategory ? stock.category === searchCategory : true;
    const matchesSupplier = searchSupplier ? stock.supplier_name === searchSupplier : true;

    return (matchesCode || matchesName) && matchesCategory && matchesSupplier;
  });


  const totalPages = Math.ceil(filteredStocks.length / itemsPerPage);
  const paginatedStocks = filteredStocks.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

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
      purchase_price: '', selling_price: '', expire_date: '', supplier_name: '',
      purchase_date: '', status: 'Active', existing_image: ''
    })
    setImageFile(null)
    fetchStocks()
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // month is 0-based
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };


  const handleEdit = (stock) => {
    setForm({
      id: stock.id,
      item_code: stock.item_code,
      item_name: stock.item_name,
      category: stock.category,
      quantity: stock.quantity,
      purchase_price: stock.purchase_price,
      selling_price: stock.selling_price,
      expire_date: stock.expire_date ? formatDate(stock.expire_date) : '',
      supplier_name: stock.supplier_name,
      purchase_date: stock.purchase_date ? formatDate(stock.purchase_date) : '',
      status: stock.status,
      existing_image: stock.image_path || ''
    });
    setImageFile(null);
  };


  const handleDelete = async (id) => {
    await axios.delete('/api/stocks', { data: { id } })
    fetchStocks()
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold text-indigo-700 mb-6">📦 Stock Management</h1>

      <form onSubmit={handleSubmit} encType="multipart/form-data" className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-6 rounded-lg shadow mb-4">
        <input type="hidden" name="existing_image" value={form.existing_image} />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Item Code</label>
          <input
            value={form.item_code}
            onChange={(e) => setForm({ ...form, item_code: e.target.value })}
            required
            className="border border-gray-300 p-2 rounded-md w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
          <input
            value={form.item_name}
            onChange={(e) => setForm({ ...form, item_name: e.target.value })}
            required
            className="border border-gray-300 p-2 rounded-md w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            required
            className="border border-gray-300 p-2 rounded-md w-full"
          >
            <option value="">Select Category</option>
            {categories.map((cat, index) => (
              <option key={index} value={cat.name}>{cat.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
          <input
            type="number"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            required
            className="border border-gray-300 p-2 rounded-md w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Price (PKR)</label>
          <input
            type="number"
            value={form.purchase_price}
            onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
            required
            className="border border-gray-300 p-2 rounded-md w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price (PKR)</label>
          <input
            type="number"
            value={form.selling_price}
            onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
            required
            className="border border-gray-300 p-2 rounded-md w-full"
          />
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
              <option key={index} value={sup.name}>
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
            onChange={(e) => setImageFile(e.target.files[0])}
            className="file:mr-4 file:py-1 file:px-2 file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 cursor-pointer"
          />
        </div>

        <div className="col-span-1 md:col-span-2 lg:col-span-1 flex items-end">
          <button
            type="submit"
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-md shadow"
          >
            {form.id ? 'Update Stock' : 'Add Stock'}
          </button>
        </div>
      </form>


      {/* Table Section */}
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
                <th className="p-3">Purchase</th>
                <th className="p-3">Selling</th>
                <th className="p-3">Expire Date</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedStocks.map((stock, i) => (
                <tr
                  key={stock.id}
                  className={`hover:bg-indigo-50 transition duration-200 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    }`}
                >
                  <td className="p-3">
                    {stock.image_path ? (
                      <img
                        src={stock.image_path}
                        alt="Item"
                        className="h-10 w-10 rounded object-cover border"
                      />
                    ) : (
                      <span className="text-gray-400">No Image</span>
                    )}
                  </td>
                  <td className="p-3">{stock.item_code}</td>
                  <td className="p-3 font-medium">{stock.item_name}</td>
                  <td className="p-3">{stock.category}</td>
                  <td className="p-3">{stock.quantity}</td>
                  <td className="p-3 text-blue-700 font-semibold">
                    Rs {Number(stock.purchase_price).toLocaleString()}
                  </td>
                  <td className="p-3 text-blue-700 font-semibold">
                    Rs {Number(stock.selling_price).toLocaleString()}
                  </td>
                  <td className="p-3">{new Date(stock.expire_date).toLocaleDateString()}</td>
                  <td
                    className={`p-3 font-semibold ${stock.status === 'Active' ? 'text-green-600' : 'text-red-600'
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
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center mt-6 text-sm text-gray-600">
          <p>
            Showing {filteredStocks.length ? (currentPage - 1) * itemsPerPage + 1 : 0}–
            {Math.min(currentPage * itemsPerPage, filteredStocks.length)} of {filteredStocks.length}
          </p>

          <div className="space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
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
