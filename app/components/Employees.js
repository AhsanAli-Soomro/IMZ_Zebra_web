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
        <div className="p-6">
            <h1 className="text-xl font-bold mb-4">Manage Employees</h1>

            <form onSubmit={handleSubmit} className="mb-6 grid grid-cols-4 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Full Name</label>
                    <input
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Full Name"
                        className="border p-2 w-full"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Email Address</label>
                    <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="Email"
                        className="border p-2 w-full"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Password</label>
                    <input
                        type="password"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        placeholder="Password"
                        className="border p-2 w-full"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">User Type</label>
                    <select
                        value={form.user_type}
                        onChange={(e) => setForm({ ...form, user_type: e.target.value })}
                        className="border p-2 w-full"
                        required
                    >
                        <option value="Admin">Admin</option>
                        <option value="Employee">Employee</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Salary (in PKR)</label>
                    <input
                        type="number"
                        value={form.salary}
                        onChange={(e) => setForm({ ...form, salary: e.target.value })}
                        placeholder="Salary"
                        className="border p-2 w-full"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Phone Number</label>
                    <input
                        type="text"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="Phone"
                        className="border p-2 w-full"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Date of Birth (DOB)</label>
                    <input
                        type="date"
                        value={form.dob}
                        onChange={(e) => setForm({ ...form, dob: e.target.value })}
                        className="border p-2 w-full"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Date of Joining</label>
                    <input
                        type="date"
                        value={form.date_of_joining}
                        onChange={(e) => setForm({ ...form, date_of_joining: e.target.value })}
                        className="border p-2 w-full"
                    />
                </div>

                <div className="col-span-1">
                    <button
                        type="submit"
                        className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                    >
                        {form.id ? 'Update Employee' : 'Add Employee'}
                    </button>
                </div>
            </form>


            <table className="w-full border">
                <thead>
                    <tr className="bg-gray-200">
                        <th className="border px-2 py-1">Name</th>
                        <th className="border px-2 py-1">Email</th>
                        <th className="border px-2 py-1">Sallary</th>
                        <th className="border px-2 py-1">Type</th>
                        <th className="border px-2 py-1">Phone</th>
                        <th className="border px-2 py-1">DOB</th>
                        <th className="border px-2 py-1">Joining Date</th>
                        <th className="border px-2 py-1">Actions</th>
                    </tr>
                </thead>

                <tbody>
                    {employees.map(emp => (
                        <tr key={emp.id}>
                            <td className="border px-2 py-1">{emp.name}</td>
                            <td className="border px-2 py-1">{emp.email}</td>
                            <td className="border px-2 py-1">{emp.salary}</td>
                            <td className="border px-2 py-1">{emp.user_type}</td>
                            <td className="border px-2 py-1">{emp.phone}</td>
                            <td className="border px-2 py-1">
                                {emp.dob ? new Date(emp.dob).toISOString().slice(0, 10) : ''}
                            </td>
                            <td className="border px-2 py-1">
                                {emp.date_of_joining ? new Date(emp.date_of_joining).toISOString().slice(0, 10) : ''}
                            </td>

                            <td className="border px-2 py-1 space-x-2">
                                <button onClick={() => handleEdit(emp)} className="text-blue-600">Edit</button>
                                <button onClick={() => handleDelete(emp.id)} className="text-red-600">Delete</button>
                            </td>
                        </tr>
                    ))}
                </tbody>

            </table>
        </div>
    )
}
