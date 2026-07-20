'use client'

import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

export default function Suppliers({ setActive, setSelectedSupplierId }) {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
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
    try {
      setLoading(true)
      const res = await axios.get('/api/suppliers')
      setSuppliers(res.data.data || [])
    } finally {
      setLoading(false)
    }
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
    const ok = window.confirm('Are you sure you want to delete this supplier?')
    if (!ok) return

    await axios.delete('/api/suppliers', { data: { id } })
    fetchSuppliers()
  }

  const filteredSuppliers = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    if (!keyword) return suppliers

    return suppliers.filter((sup) =>
      [sup.name, sup.company_name, sup.email, sup.phone, sup.address, sup.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    )
  }, [suppliers, search])

  const stats = useMemo(() => {
    const active = suppliers.filter((supplier) =>
      String(supplier.status || '').toLowerCase() === 'active'
    ).length

    return {
      total: suppliers.length,
      active,
      inactive: suppliers.length - active,
    }
  }, [suppliers])

  const openKhata = (supplierId) => {
    if (setSelectedSupplierId) setSelectedSupplierId(supplierId)
    if (setActive) setActive('Supplier Khata')
  }

  return (
<div className="space-y-5">
  <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Supplier Management</h1>
        <p className="text-sm text-gray-500 mt-1">
          Add suppliers, open khata, and manage purchase accounts.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 min-w-full lg:min-w-[360px]">
        <div className="border rounded-lg p-3 bg-gray-50">
          <p className="text-xs text-gray-500">Total</p>
          <p className="text-xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="border rounded-lg p-3 bg-green-50">
          <p className="text-xs text-gray-500">Active</p>
          <p className="text-xl font-bold text-green-700">{stats.active}</p>
        </div>
        <div className="border rounded-lg p-3 bg-red-50">
          <p className="text-xs text-gray-500">Inactive</p>
          <p className="text-xl font-bold text-red-700">{stats.inactive}</p>
        </div>
      </div>
    </div>
  </div>

  <div className="p-5 bg-white border border-gray-200 rounded-lg shadow-sm">
  <h2 className="text-lg font-semibold text-gray-900 mb-6">
    {form.id ? 'Update Supplier' : 'Add Supplier'}
  </h2>
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
  </div>

  <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Supplier List</h2>
        <p className="text-sm text-gray-500">
          Showing {filteredSuppliers.length} of {suppliers.length} suppliers
        </p>
      </div>

      <input
        type="search"
        value={search}
        placeholder="Search suppliers..."
        className="border border-gray-300 p-2 rounded-md w-full md:max-w-sm"
        onChange={(e) => setSearch(e.target.value)}
      />
    </div>

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
      {loading ? (
        <tr>
          <td colSpan="7" className="px-4 py-6 text-center text-gray-500">
            Loading suppliers...
          </td>
        </tr>
      ) : filteredSuppliers.length === 0 ? (
        <tr>
          <td colSpan="7" className="px-4 py-6 text-center text-gray-500">
            No suppliers found.
          </td>
        </tr>
      ) : filteredSuppliers.map((sup, idx) => (
        <tr
          key={sup.id}
          className={`transition duration-200 ${
            idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
          } hover:bg-indigo-50`}
        >
          <td className="px-4 py-2">{sup.name}</td>
          <td className="px-4 py-2">{sup.company_name}</td>
          <td className="px-4 py-2">{sup.email || '-'}</td>
          <td className="px-4 py-2">{sup.phone || '-'}</td>
          <td className="px-4 py-2">{sup.address || '-'}</td>
          <td
            className={`px-4 py-2 font-medium ${
              sup.status === 'Active' ? 'text-green-600' : 'text-red-600'
            }`}
          >
            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
              String(sup.status || '').toLowerCase() === 'active'
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {sup.status || '-'}
            </span>
          </td>
          <td className="px-4 py-2">
            <div className="flex flex-wrap gap-3">
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

            <button
              onClick={() => openKhata(sup.id)}
              className="text-blue-700 hover:underline font-medium"
            >
              Open Khata
            </button>
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
  </div>
</div>

  )
}
