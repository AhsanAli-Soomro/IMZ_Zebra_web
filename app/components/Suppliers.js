'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [form, setForm] = useState({
    id: null,
    name: '',
    company_name: '',
    email: '',
    phone: '',
    address: '',
    status: 'Active'
  })

  const fetchSuppliers = async () => {
    const res = await axios.get('/api/suppliers')
    setSuppliers(res.data.data)
  }

  useEffect(() => {
    fetchSuppliers()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (form.id) {
      await axios.put('/api/suppliers', form)
    } else {
      await axios.post('/api/suppliers', form)
    }

    setForm({
      id: null,
      name: '',
      company_name: '',
      email: '',
      phone: '',
      address: '',
      status: 'Active'
    })

    fetchSuppliers()
  }

  const handleEdit = (supplier) => {
    setForm(supplier)
  }

  const handleDelete = async (id) => {
    await axios.delete('/api/suppliers', { data: { id } })
    fetchSuppliers()
  }

  return (
<div className="p-6 bg-white rounded-lg shadow-lg">
  <h1 className="text-xl font-bold text-indigo-700 mb-6">🏢 Supplier Management</h1>

  <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
      <input
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        required
        className="border border-gray-300 p-2 rounded-md w-full"
        placeholder="Supplier name"
      />
    </div>

    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
      <input
        value={form.company_name}
        onChange={(e) => setForm({ ...form, company_name: e.target.value })}
        className="border border-gray-300 p-2 rounded-md w-full"
        placeholder="Company"
      />
    </div>

    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
      <input
        type="email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        className="border border-gray-300 p-2 rounded-md w-full"
        placeholder="supplier@example.com"
      />
    </div>

    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
      <input
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
        className="border border-gray-300 p-2 rounded-md w-full"
        placeholder="+91-..."
      />
    </div>

    <div className="md:col-span-2">
      <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
      <textarea
        value={form.address}
        onChange={(e) => setForm({ ...form, address: e.target.value })}
        className="border border-gray-300 p-2 rounded-md w-full"
        placeholder="Supplier address"
      ></textarea>
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

    <div className="md:col-span-1 flex items-end">
      <button
        type="submit"
        className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition"
      >
        {form.id ? 'Update Supplier' : 'Add Supplier'}
      </button>
    </div>
  </form>

  <table className="w-full text-sm rounded overflow-hidden">
    <thead className="bg-indigo-600 text-white">
      <tr>
        <th className="px-4 py-2 text-left">Name</th>
        <th className="px-4 py-2 text-left">Company</th>
        <th className="px-4 py-2 text-left">Email</th>
        <th className="px-4 py-2 text-left">Phone</th>
        <th className="px-4 py-2 text-left">Address</th>
        <th className="px-4 py-2 text-left">Status</th>
        <th className="px-4 py-2 text-left">Actions</th>
      </tr>
    </thead>
    <tbody>
      {suppliers.map((sup, idx) => (
        <tr
          key={sup.id}
          className={`transition duration-200 ${
            idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
          } hover:bg-indigo-50`}
        >
          <td className="px-4 py-2">{sup.name}</td>
          <td className="px-4 py-2">{sup.company_name}</td>
          <td className="px-4 py-2">{sup.email}</td>
          <td className="px-4 py-2">{sup.phone}</td>
          <td className="px-4 py-2">{sup.address}</td>
          <td
            className={`px-4 py-2 font-medium ${
              sup.status === 'Active' ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {sup.status}
          </td>
          <td className="px-4 py-2 space-x-2">
            <button
              onClick={() => handleEdit(sup)}
              className="text-indigo-600 hover:underline"
            >
              Edit
            </button>
            <button
              onClick={() => handleDelete(sup.id)}
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

  )
}
