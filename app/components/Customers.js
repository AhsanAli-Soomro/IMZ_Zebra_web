'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'

export default function Customers({ setActive, setSelectedCustomerId }) {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    id: null,
    name: '',
    email: '',
    phone: '',
    address: '',
    status: 'Active',
  })

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      const res = await axios.get('/api/customers')
      setCustomers(res.data.data || [])
    } catch (error) {
      console.error('Failed to fetch customers:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
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
        status: 'Active',
      })

      fetchCustomers()
    } catch (error) {
      console.error('Customer save failed:', error)
      alert(error?.response?.data?.message || 'Failed to save customer')
    }
  }

  const handleEdit = (customer) => {
    setForm({
      id: customer.id,
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      status: customer.status || 'Active',
    })
  }

  const handleDelete = async (id) => {
    const ok = window.confirm('Are you sure you want to delete this customer?')
    if (!ok) return

    try {
      await axios.delete('/api/customers', { data: { id } })
      fetchCustomers()
    } catch (error) {
      console.error('Customer delete failed:', error)
      alert(error?.response?.data?.message || 'Failed to delete customer')
    }
  }

  const openKhata = (customerId) => {
    if (setSelectedCustomerId) setSelectedCustomerId(customerId)
    if (setActive) setActive('Customer Khata')
  }

  const openInvoice = (customerId) => {
    if (setSelectedCustomerId) setSelectedCustomerId(customerId)
    if (setActive) setActive('Create Invoice')
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl font-bold text-indigo-700">👥 Customer Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Add, update, manage customers, open khata, and create invoices.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            className="border border-gray-300 p-2 rounded-md w-full"
            placeholder="Customer name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="border border-gray-300 p-2 rounded-md w-full"
            placeholder="customer@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="border border-gray-300 p-2 rounded-md w-full"
            placeholder="+92..."
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
          <textarea
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="border border-gray-300 p-2 rounded-md w-full"
            placeholder="Customer address"
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

        <div className="md:col-span-1 flex items-end">
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition"
          >
            {form.id ? 'Update Customer' : 'Add Customer'}
          </button>
        </div>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-sm rounded overflow-hidden">
          <thead className="bg-indigo-600 text-white">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
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
                <td colSpan="6" className="px-4 py-6 text-center text-gray-500">
                  Loading customers...
                </td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-4 py-6 text-center text-gray-500">
                  No customers found.
                </td>
              </tr>
            ) : (
              customers.map((cus, idx) => (
                <tr
                  key={cus.id || idx}
                  className={`transition duration-200 ${
                    idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  } hover:bg-indigo-50`}
                >
                  <td className="px-4 py-2">{cus.name}</td>
                  <td className="px-4 py-2">{cus.email || '-'}</td>
                  <td className="px-4 py-2">{cus.phone || '-'}</td>
                  <td className="px-4 py-2">{cus.address || '-'}</td>
                  <td
                    className={`px-4 py-2 font-medium ${
                      cus.status === 'Active' ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {cus.status}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => handleEdit(cus)}
                        className="text-indigo-600 hover:underline"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => handleDelete(cus.id)}
                        className="text-red-600 hover:underline"
                      >
                        Delete
                      </button>

                      <button
                        onClick={() => openKhata(cus.id)}
                        className="text-blue-700 hover:underline font-medium"
                      >
                        Open Khata
                      </button>

                      <button
                        onClick={() => openInvoice(cus.id)}
                        className="text-green-700 hover:underline font-medium"
                      >
                        New Invoice
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}