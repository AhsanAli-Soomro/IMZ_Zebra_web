'use client'

import { useEffect, useMemo, useState } from 'react'
import { get, post, put } from '../../lib/axiosService'
import axios from 'axios'

export const AVAILABLE_MODULES = [
  { id: 'Dashboard', label: 'Dashboard', icon: '📊', category: 'Core' },
  { id: 'Stock', label: 'Stock Management', icon: '📦', category: 'Inventory' },
  { id: 'Stores', label: 'Godown & Stores', icon: '🏬', category: 'Inventory' },
  { id: 'Inventory', label: 'Inventory Details', icon: '📋', category: 'Inventory' },
  { id: 'Customers', label: 'Customers & Ledgers', icon: '👥', category: 'Sales' },
  { id: 'Sale Invoice', label: 'Sale Invoice / POS', icon: '🧾', category: 'Sales' },
  { id: 'Purchase Invoice', label: 'Purchase Invoice', icon: '🛒', category: 'Purchases' },
  { id: 'Suppliers', label: 'Suppliers & Ledgers', icon: '🚛', category: 'Purchases' },
  { id: 'Categories', label: 'Product Categories', icon: '🏷️', category: 'Inventory' },
  { id: 'Employees', label: 'Employees Management', icon: '👔', category: 'Management' },
  { id: 'Billing History', label: 'Billing & Invoices History', icon: '📜', category: 'Finance' },
  { id: 'Daily Ledger', label: 'Daily Ledger', icon: '📖', category: 'Finance' },
  { id: 'Cash Information', label: 'Cash Information & Flow', icon: '💵', category: 'Finance' },
  { id: 'Cash in Hand', label: 'Cash in Hand Balance', icon: '💰', category: 'Finance' },
  { id: 'Bank Management Credit', label: 'Bank Credit Accounts', icon: '🏦', category: 'Banking' },
  { id: 'Bank Management Debit', label: 'Bank Debit Accounts', icon: '💳', category: 'Banking' },
  { id: 'Report and Analytics', label: 'Reports & Analytics', icon: '📈', category: 'Reports' },
  { id: 'Expenses', label: 'Expenses Management', icon: '💸', category: 'Finance' },
  { id: 'Calculator', label: 'Profit / Loss Calculator', icon: '🧮', category: 'Tools' },
  { id: 'Import Export Data', label: 'Import Export Data (Backup)', icon: '💾', category: 'Tools' },
]

export const ROLE_PRESETS = {
  Admin: {
    label: '👑 Admin / Business Owner',
    badge: 'bg-purple-100 text-purple-800 border-purple-200',
    description: 'Full unrestricted access to all 20 modules and settings.',
    tabs: ['ALL'],
  },
  Manager: {
    label: '💼 General Manager',
    badge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    description: 'Operations manager: sales, stock, ledgers, cash flow, and analytics.',
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
    description: 'Counter sales: create sale invoices, billing history, daily cash, and customer khata.',
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
    description: 'Supplier purchases, stock receiving, store additions, and supplier khata.',
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
    label: '👤 Custom / General Staff',
    badge: 'bg-gray-100 text-gray-800 border-gray-200',
    description: 'General staff with customizable module permissions.',
    tabs: [
      'Sale Invoice',
      'Billing History',
    ],
  },
}

export default function Employees() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [showPermissionsPanel, setShowPermissionsPanel] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Quick Permissions Modal state (for viewing/modifying directly from table)
  const [modalEmployee, setModalEmployee] = useState(null)
  const [modalTabs, setModalTabs] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)

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
  })

  // Selected module tabs for current form
  const [selectedTabs, setSelectedTabs] = useState(ROLE_PRESETS.Cashier.tabs)

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

  // When role changes in form, auto-apply professional default tabs
  const handleRoleSelect = (newRole) => {
    const preset = ROLE_PRESETS[newRole]
    let defaultList = []
    if (preset) {
      if (preset.tabs.includes('ALL')) {
        defaultList = AVAILABLE_MODULES.map((m) => m.id)
      } else {
        defaultList = [...preset.tabs]
      }
    } else {
      defaultList = AVAILABLE_MODULES.map((m) => m.id)
    }

    setForm((prev) => ({ ...prev, user_type: newRole }))
    setSelectedTabs(defaultList)
  }

  const toggleTab = (tabId) => {
    setSelectedTabs((prev) =>
      prev.includes(tabId) ? prev.filter((id) => id !== tabId) : [...prev, tabId]
    )
  }

  const selectAllTabs = () => {
    setSelectedTabs(AVAILABLE_MODULES.map((m) => m.id))
  }

  const clearAllTabs = () => {
    setSelectedTabs([])
  }

  const resetToRolePreset = () => {
    const preset = ROLE_PRESETS[form.user_type]
    if (preset) {
      if (preset.tabs.includes('ALL')) {
        setSelectedTabs(AVAILABLE_MODULES.map((m) => m.id))
      } else {
        setSelectedTabs([...preset.tabs])
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    setSaving(true)

    try {
      const payloadTabs =
        selectedTabs.length === AVAILABLE_MODULES.length || form.user_type === 'Admin'
          ? 'ALL'
          : selectedTabs

      const payload = {
        ...form,
        allowed_tabs: payloadTabs,
      }

      if (form.id) {
        await put('/api/employees', payload)
        setSuccessMsg(`Employee "${form.name}" updated successfully!`)
      } else {
        await post('/api/employees', payload)
        setSuccessMsg(`New employee "${form.name}" created successfully with role ${form.user_type}!`)
      }

      // Reset form
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
    })
    setSelectedTabs([...ROLE_PRESETS.Cashier.tabs])
    setErrorMsg('')
  }

  const handleEdit = (emp) => {
    let tabs = []
    try {
      if (emp.allowed_tabs === 'ALL' || !emp.allowed_tabs) {
        tabs = AVAILABLE_MODULES.map((m) => m.id)
      } else if (Array.isArray(emp.allowed_tabs)) {
        tabs = emp.allowed_tabs
      } else {
        tabs = JSON.parse(emp.allowed_tabs)
      }
    } catch {
      tabs = AVAILABLE_MODULES.map((m) => m.id)
    }

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
    })
    setSelectedTabs(tabs)
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

  // Quick Permissions Modal Handlers
  const openModalPermissions = (emp) => {
    setModalEmployee(emp)
    let tabs = []
    try {
      if (emp.allowed_tabs === 'ALL' || !emp.allowed_tabs) {
        tabs = AVAILABLE_MODULES.map((m) => m.id)
      } else if (Array.isArray(emp.allowed_tabs)) {
        tabs = emp.allowed_tabs
      } else {
        tabs = JSON.parse(emp.allowed_tabs)
      }
    } catch {
      tabs = AVAILABLE_MODULES.map((m) => m.id)
    }
    setModalTabs(tabs)
    setIsModalOpen(true)
  }

  const toggleModalTab = (tabId) => {
    setModalTabs((prev) =>
      prev.includes(tabId) ? prev.filter((id) => id !== tabId) : [...prev, tabId]
    )
  }

  const handleSaveModalPermissions = async () => {
    if (!modalEmployee) return
    try {
      const payloadTabs =
        modalTabs.length === AVAILABLE_MODULES.length || modalEmployee.user_type === 'Admin'
          ? 'ALL'
          : modalTabs

      await put('/api/employees', {
        id: modalEmployee.id,
        name: modalEmployee.name,
        email: modalEmployee.email,
        password: modalEmployee.password,
        user_type: modalEmployee.user_type,
        salary: modalEmployee.salary,
        dob: modalEmployee.dob,
        date_of_joining: modalEmployee.date_of_joining,
        phone: modalEmployee.phone,
        allowed_tabs: payloadTabs,
      })

      setIsModalOpen(false)
      fetchEmployees()
      setSuccessMsg(`Permissions updated for "${modalEmployee.name}"!`)
    } catch (err) {
      alert('Failed to save permissions.')
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
              Employee & Role Management
            </h1>
          </div>
          <p className="text-xs text-indigo-200 font-medium">
            Create user accounts with professional roles (Cashier, Manager, Accountant, Store Keeper) and custom sidebar permissions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/20 text-xs flex items-center gap-2">
            <span className="text-indigo-200">Total Accounts:</span>
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
                placeholder="bilal@zebrams.com"
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
                Select Professional Role <span className="text-red-500">*</span>
              </label>
              <select
                value={form.user_type}
                onChange={(e) => handleRoleSelect(e.target.value)}
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

          {/* Role Description Card */}
          {ROLE_PRESETS[form.user_type] && (
            <div className="bg-indigo-50/70 border border-indigo-200 p-3.5 rounded-2xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="font-extrabold text-indigo-900 block">
                  {ROLE_PRESETS[form.user_type].label}:
                </span>
                <span className="text-indigo-700 text-[11px]">
                  {ROLE_PRESETS[form.user_type].description}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-bold text-gray-600 text-[11px]">
                  Allowed Modules: <strong className="text-indigo-700">{selectedTabs.length} / {AVAILABLE_MODULES.length}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setShowPermissionsPanel(!showPermissionsPanel)}
                  className="px-3 py-1 bg-white border border-indigo-300 rounded-xl font-bold text-indigo-700 hover:bg-indigo-100 text-[11px] transition-colors"
                >
                  {showPermissionsPanel ? 'Hide Tabs' : 'Customize Tabs ▾'}
                </button>
              </div>
            </div>
          )}

          {/* Module Access / Permissions Section */}
          {showPermissionsPanel && (
            <div className="bg-gray-50/90 border border-gray-200 rounded-2xl p-4 space-y-3 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2 text-xs">
                <div>
                  <h4 className="font-extrabold text-gray-800 flex items-center gap-1.5">
                    <span>📑</span>
                    <span>Sidebar Module Permissions for {form.name || form.user_type}</span>
                  </h4>
                  <p className="text-[11px] text-gray-500">
                    Uncheck any tab you want to hide from this employee.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllTabs}
                    className="px-2.5 py-1 bg-white border border-gray-300 rounded-lg font-bold text-gray-700 hover:bg-gray-100 text-[11px]"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={clearAllTabs}
                    className="px-2.5 py-1 bg-white border border-gray-300 rounded-lg font-bold text-red-600 hover:bg-red-50 text-[11px]"
                  >
                    Clear All
                  </button>
                  <button
                    type="button"
                    onClick={resetToRolePreset}
                    className="px-2.5 py-1 bg-indigo-50 border border-indigo-300 rounded-lg font-bold text-indigo-700 hover:bg-indigo-100 text-[11px]"
                    title="Reset to default tabs for this role"
                  >
                    Reset Role Defaults
                  </button>
                </div>
              </div>

              {/* Checkboxes Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
                {AVAILABLE_MODULES.map((mod) => {
                  const checked = selectedTabs.includes(mod.id)
                  return (
                    <label
                      key={mod.id}
                      className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer transition-colors ${
                        checked
                          ? 'border-indigo-400 bg-indigo-50/60 font-bold text-indigo-950 shadow-xs'
                          : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTab(mod.id)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-base">{mod.icon}</span>
                      <span className="flex-1 truncate">{mod.label}</span>
                      <span className="text-[9px] text-gray-400 font-normal">
                        {mod.category}
                      </span>
                    </label>
                  )
                })}
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
                <th className="py-3 px-4 font-semibold">Allowed Modules</th>
                <th className="py-3 px-4 font-semibold">Salary (PKR)</th>
                <th className="py-3 px-4 font-semibold">Phone & Contact</th>
                <th className="py-3 px-4 font-semibold">Joining Date</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-gray-500">
                    Loading accounts...
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-gray-400">
                    No employees found matching filter.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => {
                  const rolePreset = ROLE_PRESETS[emp.user_type] || ROLE_PRESETS.Employee
                  let tabCount = AVAILABLE_MODULES.length
                  if (emp.allowed_tabs && emp.allowed_tabs !== 'ALL') {
                    try {
                      const parsed = Array.isArray(emp.allowed_tabs) ? emp.allowed_tabs : JSON.parse(emp.allowed_tabs)
                      tabCount = parsed.length
                    } catch {}
                  }

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

                      {/* Allowed Modules */}
                      <td className="py-3 px-4 align-middle">
                        <button
                          type="button"
                          onClick={() => openModalPermissions(emp)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold hover:bg-indigo-100 text-[11px] flex items-center gap-1.5 transition-colors"
                          title="Click to view or edit allowed tabs"
                        >
                          <span>📑</span>
                          <span>
                            {emp.allowed_tabs === 'ALL' || !emp.allowed_tabs
                              ? 'All 20 Modules'
                              : `${tabCount} Modules`}
                          </span>
                        </button>
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

      {/* 4. Quick Permissions Modal */}
      {isModalOpen && modalEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-6 space-y-4 border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span>📑</span>
                  <span>Module Permissions: {modalEmployee.name}</span>
                </h3>
                <p className="text-xs text-gray-500">
                  Role: <strong className="text-gray-800">{modalEmployee.user_type}</strong> ({modalEmployee.email})
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ×
              </button>
            </div>

            <div className="flex items-center justify-between bg-indigo-50 p-2.5 rounded-xl border border-indigo-200 text-xs">
              <span className="font-semibold text-indigo-900">
                Enabled Tabs: <strong className="text-indigo-700">{modalTabs.length} / {AVAILABLE_MODULES.length}</strong>
              </span>
              <div className="space-x-2">
                <button
                  type="button"
                  onClick={() => setModalTabs(AVAILABLE_MODULES.map((m) => m.id))}
                  className="px-2.5 py-1 bg-white border rounded-lg font-bold text-gray-700 hover:bg-gray-100"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => setModalTabs([])}
                  className="px-2.5 py-1 bg-white border rounded-lg font-bold text-red-600 hover:bg-red-50"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {AVAILABLE_MODULES.map((mod) => {
                const checked = modalTabs.includes(mod.id)
                return (
                  <label
                    key={mod.id}
                    className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer transition-colors ${
                      checked
                        ? 'border-indigo-400 bg-indigo-50/60 font-bold text-indigo-950'
                        : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleModalTab(mod.id)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-base">{mod.icon}</span>
                    <span className="flex-1 truncate">{mod.label}</span>
                    <span className="text-[10px] text-gray-400 font-normal">
                      {mod.category}
                    </span>
                  </label>
                )
              })}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-gray-700 hover:bg-gray-100 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveModalPermissions}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow"
              >
                Save Permissions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
