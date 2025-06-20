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
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Supplier Management</h1>

      <form onSubmit={handleSubmit} className="grid grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1">Full Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            className="border p-2 w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Company Name</label>
          <input
            value={form.company_name}
            onChange={(e) => setForm({ ...form, company_name: e.target.value })}
            className="border p-2 w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="border p-2 w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Phone</label>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="border p-2 w-full"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1">Address</label>
          <textarea
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="border p-2 w-full"
          ></textarea>
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

        <div className="col-span-1">
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            {form.id ? 'Update Supplier' : 'Add Supplier'}
          </button>
        </div>
      </form>

      <table className="w-full border">
        <thead>
          <tr className="bg-gray-200 text-left">
            <th className="border px-2 py-1">Name</th>
            <th className="border px-2 py-1">Company</th>
            <th className="border px-2 py-1">Email</th>
            <th className="border px-2 py-1">Phone</th>
            <th className="border px-2 py-1">Address</th>
            <th className="border px-2 py-1">Status</th>
            <th className="border px-2 py-1">Actions</th>
          </tr>
        </thead>
        <tbody>
          {suppliers.map(sup => (
            <tr key={sup.id}>
              <td className="border px-2 py-1">{sup.name}</td>
              <td className="border px-2 py-1">{sup.company_name}</td>
              <td className="border px-2 py-1">{sup.email}</td>
              <td className="border px-2 py-1">{sup.phone}</td>
              <td className="border px-2 py-1">{sup.address}</td>
              <td className="border px-2 py-1">{sup.status}</td>
              <td className="border px-2 py-1 space-x-2">
                <button onClick={() => handleEdit(sup)} className="text-blue-600">Edit</button>
                <button onClick={() => handleDelete(sup.id)} className="text-red-600">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
