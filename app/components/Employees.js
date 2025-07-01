'use client'

import { useEffect, useState } from 'react'
import { get, post, put } from '../../lib/axiosService'
import axios from 'axios'

export default function Employees() {
    const [employees, setEmployees] = useState([])
    const [form, setForm] = useState({
        id: null,
        name: '',
        email: '',
        password: '',
        user_type: 'Employee',
        salary: '',
        dob: '',
        date_of_joining: '',
        phone: ''
    })

    const fetchEmployees = async () => {
        const res = await get('/api/employees')
        setEmployees(res.data)
    }

    useEffect(() => {
        fetchEmployees()
    }, [])

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (form.id) {
            await put('/api/employees', form)
        } else {
            await post('/api/employees', form)
        }
        setForm({ id: null, name: '', email: '', password: '', user_type: 'Employee', salary: '', dob: '', date_of_joining: '', phone: '' })
        fetchEmployees()
    }

    const handleEdit = (emp) => {
        setForm(emp)
    }

    const handleDelete = async (id) => {
        await axios.delete('/api/employees', { data: { id } })
        fetchEmployees()
    }

    return (
<div className="p-6 bg-white rounded-lg shadow">
  <h1 className="text-2xl font-bold text-indigo-700 mb-6">👥 Manage Employees</h1>

  <form onSubmit={handleSubmit} className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
      <input
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        placeholder="Full Name"
        required
        className="border border-gray-300 p-2 rounded-md w-full focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
    </div>

    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
      <input
        type="email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        placeholder="Email"
        required
        className="border border-gray-300 p-2 rounded-md w-full focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
    </div>

    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
      <input
        type="password"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
        placeholder="Password"
        required
        className="border border-gray-300 p-2 rounded-md w-full focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
    </div>

    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">User Type</label>
      <select
        value={form.user_type}
        onChange={(e) => setForm({ ...form, user_type: e.target.value })}
        required
        className="border border-gray-300 p-2 rounded-md w-full focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        <option value="Admin">Admin</option>
        <option value="Employee">Employee</option>
      </select>
    </div>

    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Salary (PKR)</label>
      <input
        type="number"
        value={form.salary}
        onChange={(e) => setForm({ ...form, salary: e.target.value })}
        placeholder="Salary"
        className="border border-gray-300 p-2 rounded-md w-full focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
    </div>

    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
      <input
        type="text"
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
        placeholder="Phone"
        className="border border-gray-300 p-2 rounded-md w-full focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
    </div>

    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
      <input
        type="date"
        value={form.dob}
        onChange={(e) => setForm({ ...form, dob: e.target.value })}
        className="border border-gray-300 p-2 rounded-md w-full focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
    </div>

    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Date of Joining</label>
      <input
        type="date"
        value={form.date_of_joining}
        onChange={(e) => setForm({ ...form, date_of_joining: e.target.value })}
        className="border border-gray-300 p-2 rounded-md w-full focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
    </div>

    <div className="col-span-1">
      <button
        type="submit"
        className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-md font-semibold"
      >
        {form.id ? 'Update Employee' : 'Add Employee'}
      </button>
    </div>
  </form>

  <table className="w-full text-sm rounded overflow-hidden">
    <thead className="bg-indigo-600 text-white">
      <tr>
        <th className="px-3 py-2 text-left">Name</th>
        <th className="px-3 py-2 text-left">Email</th>
        <th className="px-3 py-2 text-left">Salary</th>
        <th className="px-3 py-2 text-left">Type</th>
        <th className="px-3 py-2 text-left">Phone</th>
        <th className="px-3 py-2 text-left">DOB</th>
        <th className="px-3 py-2 text-left">Joining Date</th>
        <th className="px-3 py-2 text-left">Actions</th>
      </tr>
    </thead>
    <tbody>
      {employees.map((emp, i) => (
        <tr
          key={emp.id}
          className={`transition duration-200 ${
            i % 2 === 0 ? 'bg-white' : 'bg-gray-50'
          } hover:bg-indigo-50`}
        >
          <td className="px-3 py-2">{emp.name}</td>
          <td className="px-3 py-2">{emp.email}</td>
          <td className="px-3 py-2 text-blue-700 font-semibold">
            Rs {Number(emp.salary).toLocaleString()}
          </td>
          <td className="px-3 py-2">{emp.user_type}</td>
          <td className="px-3 py-2">{emp.phone}</td>
          <td className="px-3 py-2">
            {emp.dob ? new Date(emp.dob).toLocaleDateString() : '—'}
          </td>
          <td className="px-3 py-2">
            {emp.date_of_joining ? new Date(emp.date_of_joining).toLocaleDateString() : '—'}
          </td>
          <td className="px-3 py-2 space-x-2">
            <button
              onClick={() => handleEdit(emp)}
              className="text-indigo-600 hover:underline"
            >
              Edit
            </button>
            <button
              onClick={() => handleDelete(emp.id)}
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
