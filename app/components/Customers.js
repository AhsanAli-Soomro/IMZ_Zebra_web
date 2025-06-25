'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [form, setForm] = useState({
    id: null,
    name: '',
    email: '',
    phone: '',
    address: '',
    status: 'Active'
  })

  const fetchCustomers = async () => {
    const res = await axios.get('/api/customers')
    setCustomers(res.data.data)
  }

  useEffect(() => {
    fetchCustomers()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (form.id) {
      await axios.put('/api/customers', form)
    } else {
      await axios.post('/api/customers', form)
    }

    setForm({
      id: null,
      name: '',
      email: '',
      phone: '',
      address: '',
      status: 'Active'
    })

    fetchCustomers()
  }

  const handleEdit = (customer) => {
    setForm(customer)
  }

  const handleDelete = async (id) => {
    await axios.delete('/api/customers', { data: { id } })
    fetchCustomers()
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Customer Management</h1>

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
            {form.id ? 'Update Customer' : 'Add Customer'}
          </button>
        </div>
      </form>

      <table className="w-full border">
        <thead>
          <tr className="bg-gray-200 text-left">
            <th className="border px-2 py-1">Name</th>
            <th className="border px-2 py-1">Email</th>
            <th className="border px-2 py-1">Phone</th>
            <th className="border px-2 py-1">Address</th>
            <th className="border px-2 py-1">Status</th>
            <th className="border px-2 py-1">Actions</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((cus, idx) => (
            <tr key={idx}>
              <td className="border px-2 py-1">{cus.name}</td>
              <td className="border px-2 py-1">{cus.email}</td>
              <td className="border px-2 py-1">{cus.phone}</td>
              <td className="border px-2 py-1">{cus.address}</td>
              <td className="border px-2 py-1">{cus.status}</td>
              <td className="border px-2 py-1 space-x-2">
                <button onClick={() => handleEdit(cus)} className="text-blue-600">Edit</button>
                <button onClick={() => handleDelete(cus.id)} className="text-red-600">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
