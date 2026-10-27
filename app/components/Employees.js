'use client'

import { useEffect, useMemo, useState } from 'react'
import { get, post, put } from '../../lib/axiosService'
import axios from 'axios'

export const ROLE_PRESETS = {
  Manager: {
    label: '💼 General Manager',
    badge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    description: 'Overall mill supervision: sales, stock, ledgers, cash flow, and analytics.',
    tabs: [
      'Dashboard',
      'Stock',
      'Stores',
      'Inventory',
      'Customers',
      'Sale Invoice',
      'Purchase Invoice',
      'Suppliers',
      'Categories',
      'Billing History',
      'Daily Ledger',
      'Cash Information',
      'Cash in Hand',
      'Report and Analytics',
      'Expenses',
      'Calculator',
    ],
  },
  Cashier: {
    label: '💵 Cashier / Billing Counter',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    description: 'Billing counter: sale invoices, billing history, daily ledger, cash in hand, and customer khata.',
    tabs: [
      'Sale Invoice',
      'Billing History',
      'Customers',
      'Daily Ledger',
      'Cash in Hand',
      'Calculator',
    ],
  },
  'Purchase Officer': {
    label: '🛒 Purchase Officer',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    description: 'Handles supplier purchasing, receiving, stock additions, and supplier khata.',
    tabs: [
      'Purchase Invoice',
      'Suppliers',
      'Stock',
      'Stores',
      'Inventory',
      'Categories',
      'Calculator',
    ],
  },
  'Store Keeper': {
    label: '📦 Store Keeper / Godown Incharge',
    badge: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    description: 'Warehouse stock levels, godown movement, and inventory counts.',
    tabs: [
      'Stock',
      'Stores',
      'Inventory',
      'Categories',
    ],
  },
  Accountant: {
    label: '🏦 Accountant / Munshi',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    description: 'Financial accounts: party khatas, daily ledgers, banks, cash, and expenses.',
    tabs: [
      'Dashboard',
      'Customers',
      'Suppliers',
      'Billing History',
      'Daily Ledger',
      'Cash Information',
      'Cash in Hand',
      'Bank Management Credit',
      'Bank Management Debit',
      'Expenses',
      'Report and Analytics',
      'Calculator',
    ],
  },
  Gatekeeper: {
    label: '🚪 Gatekeeper / Security',
    badge: 'bg-slate-100 text-slate-800 border-slate-200',
    description: 'Gate pass dispatch checking and warehouse stock verification.',
    tabs: [
      'Stock',
      'Stores',
      'Inventory',
    ],
  },
  Employee: {
    label: '👤 Staff / General Employee',
    badge: 'bg-gray-100 text-gray-800 border-gray-200',
    description: 'General staff: sale invoices and billing history.',
    tabs: [
      'Sale Invoice',
      'Billing History',
    ],
  },
  Admin: {
    label: '👑 Admin / Business Owner',
    badge: 'bg-purple-100 text-purple-800 border-purple-200',
    description: 'Full complete administrative access to all modules.',
    tabs: ['ALL'],
  },
}

export default function Employees() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [form, setForm] = useState({
    id: null,
    name: '',
    email: '',
    password: '',
    user_type: 'Cashier',
    salary: '',
    dob: '',
    date_of_joining: '',
    phone: '',
    allowed_tabs: null, // Preserved in background
  })

  const fetchEmployees = async () => {
    try {
      setLoading(true)
      const res = await get('/api/employees')
      setEmployees(res.data || [])
    } catch (err) {
      console.error('Failed to fetch employees:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEmployees()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    setSaving(true)

    try {
      // If new employee, automatically assign default tabs for that role in background
      // If editing existing employee, preserve their existing allowed_tabs (set by Ahsan or preset)
      let tabsToAssign = form.allowed_tabs
      if (!form.id || !tabsToAssign) {
        const preset = ROLE_PRESETS[form.user_type]
        tabsToAssign = preset?.tabs ? (preset.tabs.includes('ALL') ? 'ALL' : preset.tabs) : 'ALL'
      }

      const payload = {
        ...form,
        allowed_tabs: tabsToAssign,
      }

      if (form.id) {
        await put('/api/employees', payload)
        setSuccessMsg(`Employee "${form.name}" updated successfully!`)
      } else {
        await post('/api/employees', payload)
        setSuccessMsg(`New employee "${form.name}" created successfully as ${ROLE_PRESETS[form.user_type]?.label || form.user_type}!`)
      }

      handleResetForm()
      fetchEmployees()
    } catch (err) {
      setErrorMsg(
        err?.response?.data?.message || err?.message || 'Failed to save employee. Please try again.'
      )
    } finally {
      setSaving(false)
    }
  }

  const handleResetForm = () => {
    setForm({
      id: null,
      name: '',
      email: '',
      password: '',
      user_type: 'Cashier',
      salary: '',
      dob: '',
      date_of_joining: '',
      phone: '',
      allowed_tabs: null,
    })
    setErrorMsg('')
  }

  const handleEdit = (emp) => {
    setForm({
      id: emp.id,
      name: emp.name || '',
      email: emp.email || '',
      password: emp.password || '',
      user_type: emp.user_type || 'Employee',
      salary: emp.salary || '',
      dob: emp.dob ? emp.dob.split('T')[0] : '',
      date_of_joining: emp.date_of_joining ? emp.date_of_joining.split('T')[0] : '',
      phone: emp.phone || '',
      allowed_tabs: emp.allowed_tabs || null, // preserve whatever Ahsan or preset assigned
    })
    setErrorMsg('')
    setSuccessMsg('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`Are you sure you want to permanently delete employee "${name || 'User'}"?`)) {
      return
    }
    try {
      await axios.delete('/api/employees', { data: { id } })
      fetchEmployees()
      setSuccessMsg(`Employee "${name || 'User'}" deleted.`)
    } catch (err) {
      setErrorMsg('Failed to delete employee.')
    }
  }

  // Filtered list
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (roleFilter !== 'ALL' && emp.user_type !== roleFilter) return false
      if (!searchTerm) return true
      const term = searchTerm.toLowerCase()
      return (
        emp.name?.toLowerCase().includes(term) ||
        emp.email?.toLowerCase().includes(term) ||
        emp.phone?.toLowerCase().includes(term) ||
        emp.user_type?.toLowerCase().includes(term)
      )
    })
  }, [employees, roleFilter, searchTerm])

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-purple-800 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-3xl">👥</span>
            <h1 className="text-2xl font-black tracking-tight">
              Employee & Staff Management
            </h1>
          </div>
          <p className="text-xs text-indigo-200 font-medium">
            Create and manage staff accounts by selecting their official company role.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/20 text-xs flex items-center gap-2">
            <span className="text-indigo-200">Total Staff:</span>
            <span className="font-bold text-white text-sm">{employees.length}</span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center justify-between">
          <span>⚠️ {errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="text-red-500 hover:text-red-700 font-bold">×</button>
        </div>
      )}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
          <span>✅ {successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-500 hover:text-emerald-700 font-bold">×</button>
        </div>
      )}

      {/* 1. Create / Edit Form Card */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between border-b pb-4 mb-5">
          <div className="flex items-center gap-2">
            <span className="text-xl">{form.id ? '✏️' : '➕'}</span>
            <h2 className="text-lg font-bold text-gray-900">
              {form.id ? `Edit Account: ${form.name}` : 'Create New Employee / User Account'}
            </h2>
          </div>
          {form.id && (
            <button
              type="button"
              onClick={handleResetForm}
              className="text-xs font-bold text-gray-500 hover:text-gray-800 underline"
            >
              Cancel Edit & Add New
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Main Credentials & Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block font-bold text-gray-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Muhammad Bilal"
                required
                className="border border-gray-300 p-2.5 rounded-xl w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">
                Email Address (Login ID) <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="bilal@company.com"
                required
                className="border border-gray-300 p-2.5 rounded-xl w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Login password"
                required
                className="border border-gray-300 p-2.5 rounded-xl w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>

            {/* Role Dropdown */}
            <div>
              <label className="block font-bold text-gray-700 mb-1">
                Staff Role / Position <span className="text-red-500">*</span>
              </label>
              <select
                value={form.user_type}
                onChange={(e) => {
                  const newRole = e.target.value
                  // If creating new, update allowed_tabs preset in background
                  const preset = ROLE_PRESETS[newRole]
                  setForm((prev) => ({
                    ...prev,
                    user_type: newRole,
                    allowed_tabs: prev.id ? prev.allowed_tabs : (preset?.tabs?.includes('ALL') ? 'ALL' : preset?.tabs),
                  }))
                }}
                required
                className="border border-gray-300 p-2.5 rounded-xl w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold bg-white text-indigo-950"
              >
                {Object.keys(ROLE_PRESETS).map((roleKey) => (
                  <option key={roleKey} value={roleKey}>
                    {ROLE_PRESETS[roleKey].label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Salary (PKR)</label>
              <input
                type="number"
                value={form.salary}
                onChange={(e) => setForm({ ...form, salary: e.target.value })}
                placeholder="e.g. 45000"
                className="border border-gray-300 p-2.5 rounded-xl w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Phone Number</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="0300-1234567"
                className="border border-gray-300 p-2.5 rounded-xl w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Date of Birth</label>
              <input
                type="date"
                value={form.dob}
                onChange={(e) => setForm({ ...form, dob: e.target.value })}
                className="border border-gray-300 p-2.5 rounded-xl w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Date of Joining</label>
              <input
                type="date"
                value={form.date_of_joining}
                onChange={(e) => setForm({ ...form, date_of_joining: e.target.value })}
                className="border border-gray-300 p-2.5 rounded-xl w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Role Description Notice */}
          {ROLE_PRESETS[form.user_type] && (
            <div className="bg-indigo-50/70 border border-indigo-200 p-3.5 rounded-2xl text-xs flex items-center justify-between">
              <div>
                <span className="font-extrabold text-indigo-900 block">
                  {ROLE_PRESETS[form.user_type].label}:
                </span>
                <span className="text-indigo-700 text-[11px]">
                  {ROLE_PRESETS[form.user_type].description}
                </span>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex items-center justify-end gap-3 pt-2">
            {form.id && (
              <button
                type="button"
                onClick={handleResetForm}
                className="px-5 py-2.5 rounded-xl border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold text-xs"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="px-7 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <span>{saving ? 'Saving...' : form.id ? 'Update Employee' : 'Save & Create Employee'}</span>
              <span>🚀</span>
            </button>
          </div>
        </form>
      </div>

      {/* 2. Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-gray-200 shadow-sm text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <span className="font-bold text-gray-500 mr-1">Filter:</span>
          {['ALL', 'Admin', 'Manager', 'Cashier', 'Purchase Officer', 'Accountant', 'Store Keeper', 'Gatekeeper'].map((rf) => (
            <button
              key={rf}
              onClick={() => setRoleFilter(rf)}
              className={`px-3 py-1 rounded-xl font-bold transition-all whitespace-nowrap ${
                roleFilter === rf
                  ? 'bg-indigo-700 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {rf}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search name, email, phone..."
            className="w-full px-3 py-1.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {/* 3. Employees Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#07502f] text-white uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-4 font-semibold">Employee</th>
                <th className="py-3 px-4 font-semibold">Role / Position</th>
                <th className="py-3 px-4 font-semibold">Salary (PKR)</th>
                <th className="py-3 px-4 font-semibold">Phone & Contact</th>
                <th className="py-3 px-4 font-semibold">Joining Date</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-gray-500">
                    Loading staff accounts...
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-gray-400">
                    No employees found matching filter.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => {
                  const rolePreset = ROLE_PRESETS[emp.user_type] || ROLE_PRESETS.Employee

                  return (
                    <tr key={emp.id} className="hover:bg-gray-50/80 transition-colors">
                      {/* Name & Email */}
                      <td className="py-3 px-4 align-middle">
                        <div className="font-extrabold text-gray-900 text-sm">{emp.name}</div>
                        <div className="text-gray-500 font-mono text-[11px] mt-0.5">{emp.email}</div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3 px-4 align-middle">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${rolePreset.badge}`}>
                          {rolePreset.label}
                        </span>
                      </td>

                      {/* Salary */}
                      <td className="py-3 px-4 align-middle font-bold text-gray-900">
                        {emp.salary ? `Rs ${Number(emp.salary).toLocaleString()}` : '—'}
                      </td>

                      {/* Phone */}
                      <td className="py-3 px-4 align-middle text-gray-600 font-medium">
                        {emp.phone || '—'}
                      </td>

                      {/* Joining Date */}
                      <td className="py-3 px-4 align-middle text-gray-500 text-[11px]">
                        {emp.date_of_joining ? new Date(emp.date_of_joining).toLocaleDateString() : '—'}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 align-middle text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleEdit(emp)}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(emp.id, emp.name)}
                          className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-lg transition-colors"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
