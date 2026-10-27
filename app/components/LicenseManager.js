'use client'

import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

export const ALL_SIDEBAR_TABS = [
  { id: 'Dashboard', label: 'Dashboard', icon: '📊', category: 'Core' },
  { id: 'Stock', label: 'Stock', icon: '📦', category: 'Inventory' },
  { id: 'Stores', label: 'Stores', icon: '🏬', category: 'Inventory' },
  { id: 'Inventory', label: 'Inventory', icon: '📋', category: 'Inventory' },
  { id: 'Customers', label: 'Customers & Ledgers', icon: '👥', category: 'Sales' },
  { id: 'Sale Invoice', label: 'Sale Invoice', icon: '🧾', category: 'Sales' },
  { id: 'Purchase Invoice', label: 'Purchase Invoice', icon: '🛒', category: 'Purchases' },
  { id: 'Suppliers', label: 'Suppliers & Ledgers', icon: '🚛', category: 'Purchases' },
  { id: 'Categories', label: 'Categories', icon: '🏷️', category: 'Inventory' },
  { id: 'Employees', label: 'Employees', icon: '👔', category: 'Management' },
  { id: 'Billing History', label: 'Billing History', icon: '📜', category: 'Finance' },
  { id: 'Daily Ledger', label: 'Daily Ledger', icon: '📖', category: 'Finance' },
  { id: 'Cash Information', label: 'Cash Information', icon: '💵', category: 'Finance' },
  { id: 'Cash in Hand', label: 'Cash in Hand', icon: '💰', category: 'Finance' },
  { id: 'Bank Management Credit', label: 'Bank Management Credit', icon: '🏦', category: 'Banking' },
  { id: 'Bank Management Debit', label: 'Bank Management Debit', icon: '💳', category: 'Banking' },
  { id: 'Report and Analytics', label: 'Reports and Analytics', icon: '📈', category: 'Reports' },
  { id: 'Expenses', label: 'Expenses', icon: '💸', category: 'Finance' },
  { id: 'Calculator', label: 'Profit / Loss Calculator', icon: '🧮', category: 'Tools' },
  { id: 'Import Export Data', label: 'Import Export Data', icon: '💾', category: 'Tools' },
]

export default function LicenseManager() {
  const [licenses, setLicenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all') // 'all', 'pending', 'active', 'suspended', 'other'
  const [searchTerm, setSearchTerm] = useState('')
  const [actionLoading, setActionLoading] = useState(null)

  // 1. License Edit Modal state
  const [selectedLicense, setSelectedLicense] = useState(null)
  const [modalStatus, setModalStatus] = useState('active')
  const [expiryOption, setExpiryOption] = useState('1_year')
  const [customDate, setCustomDate] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [maxUsers, setMaxUsers] = useState(5)
  const [statusMessage, setStatusMessage] = useState('')
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [notes, setNotes] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)

  // 2. Tabs Permissions Modal state
  const [isTabsModalOpen, setIsTabsModalOpen] = useState(false)
  const [selectedTabs, setSelectedTabs] = useState([])

  // 3. Client Users & Credentials Modal state
  const [isUsersModalOpen, setIsUsersModalOpen] = useState(false)
  const [viewingUsers, setViewingUsers] = useState([])

  const [copiedKey, setCopiedKey] = useState('')

  const fetchLicenses = async () => {
    try {
      setLoading(true)
      setError('')
      const res = await axios.get('/api/license/admin/list')
      if (res.data?.ok) {
        setLicenses(res.data.data || [])
      } else {
        setError(res.data?.error || 'Failed to load licenses')
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Error connecting to database')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLicenses()
  }, [])

  const copyToClipboard = (text, type) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text)
      setCopiedKey(`${type}_${text}`)
      setTimeout(() => setCopiedKey(''), 2000)
    }
  }

  const stats = useMemo(() => {
    const total = licenses.length
    const pending = licenses.filter((l) => l.status === 'pending').length
    const active = licenses.filter((l) => l.status === 'active').length
    const suspended = licenses.filter((l) => l.status === 'suspended').length
    const expired = licenses.filter((l) => l.status === 'expired').length
    const rejected = licenses.filter((l) => l.status === 'rejected').length
    return { total, pending, active, suspended, expired, rejected }
  }, [licenses])

  const filteredLicenses = useMemo(() => {
    return licenses.filter((item) => {
      if (filter === 'pending' && item.status !== 'pending') return false
      if (filter === 'active' && item.status !== 'active') return false
      if (filter === 'suspended' && item.status !== 'suspended') return false
      if (filter === 'other' && !['expired', 'rejected'].includes(item.status)) return false

      if (!searchTerm) return true
      const term = searchTerm.toLowerCase()
      return (
        item.company_name?.toLowerCase().includes(term) ||
        item.customer_name?.toLowerCase().includes(term) ||
        item.city?.toLowerCase().includes(term) ||
        item.contact?.toLowerCase().includes(term) ||
        item.hostname?.toLowerCase().includes(term) ||
        item.mac_address?.toLowerCase().includes(term) ||
        item.activation_key?.toLowerCase().includes(term) ||
        item.os_info?.toLowerCase().includes(term)
      )
    })
  }, [licenses, filter, searchTerm])

  // --- Handlers: License Edit Modal ---
  const openActivateModal = (license) => {
    setSelectedLicense(license)
    setModalStatus(license.status === 'pending' ? 'active' : license.status)
    setCustomerName(license.customer_name || license.company_name || '')
    setMaxUsers(license.max_users !== undefined && license.max_users !== null ? license.max_users : 5)
    setStatusMessage(license.status_message || '')
    setBroadcastMessage(license.broadcast_message || '')
    setNotes(license.notes || '')
    setExpiryOption(license.expires_at ? 'custom' : '1_year')
    setCustomDate(license.expires_at ? new Date(license.expires_at).toISOString().split('T')[0] : '')
    setIsModalOpen(true)
  }

  const calculateExpiryDate = () => {
    const now = new Date()
    if (expiryOption === 'lifetime') return null
    if (expiryOption === '1_month') {
      now.setMonth(now.getMonth() + 1)
      return now.toISOString()
    }
    if (expiryOption === '3_months') {
      now.setMonth(now.getMonth() + 3)
      return now.toISOString()
    }
    if (expiryOption === '6_months') {
      now.setMonth(now.getMonth() + 6)
      return now.toISOString()
    }
    if (expiryOption === '1_year') {
      now.setFullYear(now.getFullYear() + 1)
      return now.toISOString()
    }
    if (expiryOption === 'custom' && customDate) {
      return new Date(customDate).toISOString()
    }
    return null
  }

  const handleSaveLicense = async () => {
    if (!selectedLicense) return
    setActionLoading(selectedLicense.id)

    try {
      const expiresAt = calculateExpiryDate()
      await axios.post('/api/license/admin/update', {
        id: selectedLicense.id,
        status: modalStatus,
        expires_at: expiresAt,
        customer_name: customerName.trim(),
        max_users: Number(maxUsers),
        status_message: statusMessage.trim(),
        broadcast_message: broadcastMessage.trim(),
        notes: notes.trim(),
      })
      setIsModalOpen(false)
      fetchLicenses()
    } catch (err) {
      alert(err?.response?.data?.error || err.message || 'Failed to update device license')
    } finally {
      setActionLoading(null)
    }
  }

  // --- Handlers: Tabs Permissions Modal ---
  const openTabsModal = (license) => {
    setSelectedLicense(license)
    let tabs = []
    try {
      if (license.allowed_tabs === 'ALL' || !license.allowed_tabs) {
        tabs = ALL_SIDEBAR_TABS.map((t) => t.id)
      } else if (typeof license.allowed_tabs === 'string') {
        const parsed = JSON.parse(license.allowed_tabs)
        tabs = Array.isArray(parsed) ? parsed : ALL_SIDEBAR_TABS.map((t) => t.id)
      } else if (Array.isArray(license.allowed_tabs)) {
        tabs = license.allowed_tabs
      }
    } catch {
      tabs = ALL_SIDEBAR_TABS.map((t) => t.id)
    }
    setSelectedTabs(tabs)
    setIsTabsModalOpen(true)
  }

  const toggleTab = (tabId) => {
    setSelectedTabs((prev) =>
      prev.includes(tabId) ? prev.filter((id) => id !== tabId) : [...prev, tabId]
    )
  }

  const selectAllTabs = () => {
    setSelectedTabs(ALL_SIDEBAR_TABS.map((t) => t.id))
  }

  const clearAllTabs = () => {
    setSelectedTabs(['Dashboard'])
  }

  const handleSaveTabs = async () => {
    if (!selectedLicense) return
    setActionLoading(selectedLicense.id)
    try {
      const isAll = selectedTabs.length === ALL_SIDEBAR_TABS.length
      const payloadTabs = isAll ? 'ALL' : JSON.stringify(selectedTabs)

      await axios.post('/api/license/admin/update', {
        id: selectedLicense.id,
        allowed_tabs: payloadTabs,
      })
      setIsTabsModalOpen(false)
      fetchLicenses()
    } catch (err) {
      alert(err?.response?.data?.error || err.message || 'Failed to save tab permissions')
    } finally {
      setActionLoading(null)
    }
  }

  // --- Handlers: Users & Credentials Modal ---
  const openUsersModal = (license) => {
    setSelectedLicense(license)
    let users = []
    try {
      if (license.users_data) {
        users = typeof license.users_data === 'string' ? JSON.parse(license.users_data) : license.users_data
      }
    } catch {
      users = []
    }
    setViewingUsers(Array.isArray(users) ? users : [])
    setIsUsersModalOpen(true)
  }

  // --- Handlers: Quick Suspend Toggle ---
  const handleToggleSuspend = async (license) => {
    const isCurrentlySuspended = license.status === 'suspended'
    const newStatus = isCurrentlySuspended ? 'active' : 'suspended'

    let reason = ''
    if (!isCurrentlySuspended) {
      reason = prompt(
        `Enter suspension reason for ${license.company_name || license.customer_name || license.hostname}:`,
        'Payment pending - please contact Ahsan Ali Soomro to renew software access.'
      )
      if (reason === null) return // Cancelled
    }

    setActionLoading(license.id)
    try {
      await axios.post('/api/license/admin/update', {
        id: license.id,
        status: newStatus,
        status_message: reason || null,
      })
      fetchLicenses()
    } catch (err) {
      alert(err?.response?.data?.error || err.message || 'Failed to toggle status')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (license) => {
    if (
      !confirm(
        `Permanently delete record for ${license.company_name || license.hostname} (${license.mac_address})?`
      )
    ) {
      return
    }
    setActionLoading(license.id)
    try {
      await axios.delete(`/api/license/admin/delete?id=${license.id}`)
      fetchLicenses()
    } catch (err) {
      alert(err?.response?.data?.error || err.message || 'Failed to delete record')
    } finally {
      setActionLoading(null)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Lifetime'
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 w-full max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              🔐 Zebra IMS • Admin Licensing Center
            </h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
              Neon Cloud
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Manage client activations, user limits, credentials, remote tab permissions, and billing locks.
          </p>
        </div>

        <button
          onClick={fetchLicenses}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold shadow-sm transition-all"
        >
          <span className={loading ? 'animate-spin' : ''}>🔄</span>
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Error alert if any */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={fetchLicenses} className="underline font-bold text-xs">
            Retry
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
            Total Devices
          </span>
          <strong className="text-2xl font-black text-gray-900 mt-1 block">
            {stats.total}
          </strong>
          <span className="text-[11px] text-gray-500 mt-0.5 block">Installed Systems</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">
              Pending
            </span>
            {stats.pending > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
            )}
          </div>
          <strong className="text-2xl font-black text-amber-600 mt-1 block">
            {stats.pending}
          </strong>
          <span className="text-[11px] text-amber-700 font-medium mt-0.5 block">
            Needs activation
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm">
          <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">
            Active
          </span>
          <strong className="text-2xl font-black text-emerald-700 mt-1 block">
            {stats.active}
          </strong>
          <span className="text-[11px] text-emerald-600 font-medium mt-0.5 block">
            Licensed & Running
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-sm">
          <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider block">
            Suspended
          </span>
          <strong className="text-2xl font-black text-rose-700 mt-1 block">
            {stats.suspended}
          </strong>
          <span className="text-[11px] text-rose-600 font-medium mt-0.5 block">
            Locked / Payment Due
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
            Expired / Rejected
          </span>
          <strong className="text-2xl font-black text-gray-700 mt-1 block">
            {stats.expired + stats.rejected}
          </strong>
          <span className="text-[11px] text-gray-500 mt-0.5 block">
            {stats.expired} expired, {stats.rejected} rejected
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: 'all', label: `All (${stats.total})` },
            { id: 'pending', label: `Pending (${stats.pending})`, color: 'amber' },
            { id: 'active', label: `Active (${stats.active})`, color: 'emerald' },
            { id: 'suspended', label: `Suspended (${stats.suspended})`, color: 'rose' },
            { id: 'other', label: `Expired / Rejected (${stats.expired + stats.rejected})`, color: 'gray' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                filter === tab.id
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-72">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search Company, City, MAC, Key..."
            className="w-full px-3 py-1.5 text-xs rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#07502f] text-white uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-4 font-semibold">Client / Company</th>
                <th className="py-3 px-4 font-semibold">Contact & Location</th>
                <th className="py-3 px-4 font-semibold">Activation Key & MAC</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">User Limits</th>
                <th className="py-3 px-4 font-semibold">Modules</th>
                <th className="py-3 px-4 font-semibold">Expiration</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-gray-500">
                    Loading clients...
                  </td>
                </tr>
              ) : filteredLicenses.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-gray-400">
                    No devices match this filter.
                  </td>
                </tr>
              ) : (
                filteredLicenses.map((item) => {
                  const isPending = item.status === 'pending'
                  const isActive = item.status === 'active'
                  const isSuspended = item.status === 'suspended'
                  const isRejected = item.status === 'rejected'
                  const isExpired = item.status === 'expired'

                  let parsedUsers = []
                  try {
                    parsedUsers = typeof item.users_data === 'string' ? JSON.parse(item.users_data) : item.users_data || []
                  } catch {}

                  let parsedTabs = []
                  try {
                    if (item.allowed_tabs === 'ALL' || !item.allowed_tabs) {
                      parsedTabs = ALL_SIDEBAR_TABS.map((t) => t.id)
                    } else if (typeof item.allowed_tabs === 'string') {
                      parsedTabs = JSON.parse(item.allowed_tabs)
                    }
                  } catch {
                    parsedTabs = ALL_SIDEBAR_TABS.map((t) => t.id)
                  }

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-gray-50/80 transition-colors ${
                        isPending
                          ? 'bg-amber-50/40'
                          : isSuspended
                          ? 'bg-rose-50/30'
                          : ''
                      }`}
                    >
                      {/* Client / Company */}
                      <td className="py-3 px-4 align-middle">
                        <div className="font-extrabold text-gray-900 text-sm">
                          {item.company_name || item.customer_name || 'Unregistered Client'}
                        </div>
                        <div className="text-gray-500 text-[11px] flex items-center gap-1.5 mt-0.5">
                          <span>💻 {item.hostname || 'Unknown Host'}</span>
                          <span className="text-gray-300">•</span>
                          <span className="truncate max-w-[120px]" title={item.os_info}>
                            {item.os_info || 'Windows'}
                          </span>
                        </div>
                      </td>

                      {/* Contact & Location */}
                      <td className="py-3 px-4 align-middle text-gray-600">
                        {item.contact ? (
                          <div className="font-medium text-gray-800">📞 {item.contact}</div>
                        ) : null}
                        {item.city ? (
                          <div className="text-[11px] text-gray-500">📍 {item.city}</div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Key & MAC */}
                      <td className="py-3 px-4 align-middle space-y-1">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(item.activation_key, 'key')}
                          className="font-mono text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1 transition-colors"
                          title="Click to copy Key"
                        >
                          <span>{item.activation_key}</span>
                          <span>{copiedKey === `key_${item.activation_key}` ? '✓' : '📋'}</span>
                        </button>
                        <div className="text-[10px] font-mono text-gray-400">
                          {item.mac_address}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 align-middle">
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Pending
                          </span>
                        )}
                        {isActive && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            Active
                          </span>
                        )}
                        {isSuspended && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                            Suspended
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800">
                            Rejected
                          </span>
                        )}
                        {isExpired && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-200 text-gray-700">
                            Expired
                          </span>
                        )}
                      </td>

                      {/* User Limits */}
                      <td className="py-3 px-4 align-middle">
                        <button
                          type="button"
                          onClick={() => openUsersModal(item)}
                          className="hover:underline font-semibold text-gray-800 flex items-center gap-1"
                          title="Click to view client user accounts and credentials"
                        >
                          <span>👥</span>
                          <span>{parsedUsers.length}</span>
                          <span className="text-gray-400">/</span>
                          <span>{item.max_users || 5}</span>
                          <span className="text-[10px] text-indigo-600 font-bold ml-1">View</span>
                        </button>
                      </td>

                      {/* Modules / Tabs */}
                      <td className="py-3 px-4 align-middle">
                        <button
                          type="button"
                          onClick={() => openTabsModal(item)}
                          className="px-2 py-0.5 rounded-lg bg-gray-100 hover:bg-gray-200 font-semibold text-gray-700 text-[11px] flex items-center gap-1 transition-colors"
                          title="Click to customize enabled tabs for this client"
                        >
                          <span>📑</span>
                          <span>{parsedTabs.length} / 20 Tabs</span>
                        </button>
                      </td>

                      {/* Expiration */}
                      <td className="py-3 px-4 align-middle font-medium text-gray-700">
                        {formatDate(item.expires_at)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 align-middle text-right space-x-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openActivateModal(item)}
                          disabled={actionLoading === item.id}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-sm transition-all"
                        >
                          {isPending ? 'Activate' : '⚙️ Manage'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleSuspend(item)}
                          disabled={actionLoading === item.id}
                          className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-all ${
                            isSuspended
                              ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                          }`}
                          title={isSuspended ? 'Click to resume access' : 'Click to suspend client'}
                        >
                          {isSuspended ? '🔓 Resume' : '🔒 Lock'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          disabled={actionLoading === item.id}
                          className="px-2 py-1 rounded-lg text-gray-400 hover:text-red-600 font-bold text-[11px] transition-all"
                          title="Delete device record"
                        >
                          🗑️
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

      {/* 1. Modal: Activate / Manage License & Limits */}
      {isModalOpen && selectedLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-4 border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {selectedLicense.status === 'active'
                    ? 'Manage License & Plan'
                    : 'Activate Client Device'}
                </h3>
                <p className="text-xs text-gray-500">
                  {selectedLicense.company_name || selectedLicense.hostname} ({selectedLicense.mac_address})
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ×
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Status Selector */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">License Status</label>
                <select
                  value={modalStatus}
                  onChange={(e) => setModalStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 font-semibold"
                >
                  <option value="active">Active (Full Access)</option>
                  <option value="suspended">Suspended (Lockout Screen)</option>
                  <option value="pending">Pending Approval</option>
                  <option value="expired">Expired</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              {/* Customer / Company Name */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Customer / Business Name
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Al-Madina Rice Traders"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Max Users Limit */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Maximum Users Allowed (0 = Unlimited)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={maxUsers}
                  onChange={(e) => setMaxUsers(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 font-bold"
                />
                <span className="text-[10px] text-gray-400 mt-0.5 block">
                  Client cannot create more than this number of login users.
                </span>
              </div>

              {/* Expiry Options */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  License Expiration Duration
                </label>
                <div className="grid grid-cols-3 gap-1.5 mb-2">
                  {[
                    { label: '1 Month', val: '1_month' },
                    { label: '3 Months', val: '3_months' },
                    { label: '6 Months', val: '6_months' },
                    { label: '1 Year', val: '1_year' },
                    { label: 'Lifetime', val: 'lifetime' },
                    { label: 'Custom Date', val: 'custom' },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setExpiryOption(opt.val)}
                      className={`py-1.5 px-2 rounded-xl font-bold border transition-all text-center ${
                        expiryOption === opt.val
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {expiryOption === 'custom' && (
                  <input
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500"
                  />
                )}
              </div>

              {/* Status Message (Lockout Reason) */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Custom Lockout Message (Shown if Suspended)
                </label>
                <input
                  type="text"
                  value={statusMessage}
                  onChange={(e) => setStatusMessage(e.target.value)}
                  placeholder="e.g. Software access is suspended due to pending payment. Please contact Ahsan Ali Soomro."
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Broadcast Notice Banner */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Broadcast Notice Banner (Shown on Client Dashboard)
                </label>
                <input
                  type="text"
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="e.g. Notice: Sunday evening 9 PM system maintenance."
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Admin Notes */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">Private Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows="2"
                  placeholder="e.g. Paid Rs 50,000 for 1-year license."
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500"
                />
              </div>
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
                onClick={handleSaveLicense}
                disabled={actionLoading === selectedLicense.id}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow"
              >
                {actionLoading === selectedLicense.id ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal: Module / Tab Permissions */}
      {isTabsModalOpen && selectedLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-6 space-y-4 border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  📑 Sidebar Module Permissions
                </h3>
                <p className="text-xs text-gray-500">
                  Select which sidebar tabs are enabled for{' '}
                  <strong className="text-gray-800">
                    {selectedLicense.company_name || selectedLicense.customer_name || selectedLicense.hostname}
                  </strong>
                </p>
              </div>
              <button
                onClick={() => setIsTabsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ×
              </button>
            </div>

            <div className="flex items-center justify-between bg-gray-50 p-2.5 rounded-xl border text-xs">
              <span className="font-semibold text-gray-600">
                Enabled Tabs: <strong className="text-emerald-700">{selectedTabs.length} / {ALL_SIDEBAR_TABS.length}</strong>
              </span>
              <div className="space-x-2">
                <button
                  type="button"
                  onClick={selectAllTabs}
                  className="px-2.5 py-1 bg-white border rounded-lg font-bold text-gray-700 hover:bg-gray-100"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={clearAllTabs}
                  className="px-2.5 py-1 bg-white border rounded-lg font-bold text-red-600 hover:bg-red-50"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {ALL_SIDEBAR_TABS.map((tab) => {
                const checked = selectedTabs.includes(tab.id)
                return (
                  <label
                    key={tab.id}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                      checked
                        ? 'border-emerald-500 bg-emerald-50/60 font-bold text-gray-900'
                        : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTab(tab.id)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-base">{tab.icon}</span>
                    <span className="flex-1">{tab.label}</span>
                    <span className="text-[10px] text-gray-400 font-normal">
                      {tab.category}
                    </span>
                  </label>
                )
              })}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setIsTabsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-gray-700 hover:bg-gray-100 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTabs}
                disabled={actionLoading === selectedLicense.id}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow"
              >
                {actionLoading === selectedLicense.id ? 'Saving...' : 'Apply Module Permissions'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modal: Client Users & Credentials */}
      {isUsersModalOpen && selectedLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-6 space-y-4 border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  👥 Client User Accounts & Credentials
                </h3>
                <p className="text-xs text-gray-500">
                  Accounts created on{' '}
                  <strong className="text-gray-800">
                    {selectedLicense.company_name || selectedLicense.customer_name || selectedLicense.hostname}
                  </strong>
                </p>
              </div>
              <button
                onClick={() => setIsUsersModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ×
              </button>
            </div>

            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-xs text-emerald-900">
              <span>
                Total Accounts: <strong>{viewingUsers.length}</strong> / Allowed Limit: <strong>{selectedLicense.max_users || 5}</strong>
              </span>
              <span className="text-[11px] text-emerald-700 font-semibold">
                Auto-synced from client machine
              </span>
            </div>

            {viewingUsers.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-xs">
                No users reported yet. Data will sync automatically on client login.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100 text-gray-700 font-bold">
                    <tr>
                      <th className="py-2.5 px-3">Name</th>
                      <th className="py-2.5 px-3">Email</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Password / Access</th>
                      <th className="py-2.5 px-3 text-right">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {viewingUsers.map((u, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="py-2 px-3 font-bold text-gray-800">{u.name || '—'}</td>
                        <td className="py-2 px-3 font-mono text-gray-600">{u.email || '—'}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              u.user_type === 'Admin'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {u.user_type || 'User'}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          {u.password ? (
                            <button
                              type="button"
                              onClick={() => copyToClipboard(u.password, `pwd_${i}`)}
                              className="font-mono bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1"
                              title="Click to copy password"
                            >
                              <span>{u.password}</span>
                              <span>{copiedKey === `pwd_${i}_${u.password}` ? '✓' : '📋'}</span>
                            </button>
                          ) : (
                            <span className="text-gray-400 font-mono">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-500 text-[11px]">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-end pt-3 border-t">
              <button
                type="button"
                onClick={() => setIsUsersModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
