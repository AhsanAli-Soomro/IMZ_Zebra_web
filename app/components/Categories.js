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
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Category Management</h1>

      <form onSubmit={handleSubmit} className="grid grid-cols-4 gap-4 mb-6">
        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1">Category Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
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

        <div className="col-span-1">
          <button
            type="submit"
            className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
          >
            {form.id ? 'Update Category' : 'Add Category'}
          </button>
        </div>
      </form>

      <table className="w-full border">
        <thead>
          <tr className="bg-gray-200 text-left">
            <th className="border px-2 py-1">Name</th>
            <th className="border px-2 py-1">Status</th>
            <th className="border px-2 py-1">Actions</th>
          </tr>
        </thead>
        <tbody>
          {categories.map(( cat, i)  => (
            <tr key={i}>
              <td className="border px-2 py-1">{cat.name}</td>
              <td className="border px-2 py-1">{cat.status}</td>
              <td className="border px-2 py-1 space-x-2">
                <button onClick={() => handleEdit(cat)} className="text-blue-600">Edit</button>
                <button onClick={() => handleDelete(cat.id)} className="text-red-600">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
