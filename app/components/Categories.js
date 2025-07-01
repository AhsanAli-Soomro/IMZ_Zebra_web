'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'

export default function Categories() {
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState({
    id: null,
    name: '',
    status: 'Active'
  })

  const fetchCategories = async () => {
    const res = await axios.get('/api/categories')
    setCategories(res.data.data)
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (form.id) {
      await axios.put('/api/categories', form)
    } else {
      await axios.post('/api/categories', form)
    }

    setForm({ id: null, name: '', status: 'Active' })
    fetchCategories()
  }

  const handleEdit = (cat) => {
    setForm(cat)
  }

  const handleDelete = async (id) => {
    await axios.delete('/api/categories', { data: { id } })
    fetchCategories()
  }

  return (
<div className="p-6 bg-white rounded-lg shadow-lg">
  <h1 className="text-xl font-bold mb-6 text-indigo-700">🗂️ Category Management</h1>

  <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
    <div className="md:col-span-2">
      <label className="block text-sm font-medium text-gray-700 mb-1">Category Name</label>
      <input
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        required
        className="border border-gray-300 p-2 rounded-md w-full"
        placeholder="Enter category name"
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
        className="w-full bg-green-600 text-white py-2 rounded-md hover:bg-green-700 transition"
      >
        {form.id ? 'Update Category' : 'Add Category'}
      </button>
    </div>
  </form>

  <table className="w-full text-sm rounded overflow-hidden">
    <thead className="bg-indigo-600 text-white">
      <tr>
        <th className="px-4 py-2 text-left">Name</th>
        <th className="px-4 py-2 text-left">Status</th>
        <th className="px-4 py-2 text-left">Actions</th>
      </tr>
    </thead>
    <tbody>
      {categories.map((cat, i) => (
        <tr
          key={i}
          className={`transition duration-200 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-indigo-50`}
        >
          <td className="px-4 py-2">{cat.name}</td>
          <td
            className={`px-4 py-2 font-medium ${
              cat.status === 'Active' ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {cat.status}
          </td>
          <td className="px-4 py-2 space-x-2">
            <button onClick={() => handleEdit(cat)} className="text-indigo-600 hover:underline">
              Edit
            </button>
            <button onClick={() => handleDelete(cat.id)} className="text-red-600 hover:underline">
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
