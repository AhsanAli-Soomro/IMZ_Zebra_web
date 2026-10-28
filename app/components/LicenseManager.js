'use client'

import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { ROLE_DEFINITIONS, getRoleMeta } from '@/lib/roles'

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
  const [maxDevices, setMaxDevices] = useState(3)
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

  // 4. Per-User Tab Permissions Modal state
  const [isUserTabsModalOpen, setIsUserTabsModalOpen] = useState(false)
  const [editingUserForTabs, setEditingUserForTabs] = useState(null)
  const [userSpecificTabs, setUserSpecificTabs] = useState([])

  // 5. Client Connected Devices Modal state
  const [isDevicesModalOpen, setIsDevicesModalOpen] = useState(false)
  const [viewingDevices, setViewingDevices] = useState([])
  const [deviceLimitInput, setDeviceLimitInput] = useState(3)

  // 6. Decrypted original passwords state (protected by admin password)
  const [unlockedPasswords, setUnlockedPasswords] = useState({})
  const [revealingUserId, setRevealingUserId] = useState(null)

  const [copiedKey, setCopiedKey] = useState('')

  const fetchLicenses = async () => {
    try {
      setLoading(true)
      setError('')
      const adminPwd = sessionStorage.getItem('admin_auth_password') || ''
      if (adminPwd) {
        axios.defaults.headers.common['x-admin-password'] = adminPwd
      }
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

  const handleRevealPassword = async (user) => {
    if (!user) return
    const userId = user.id || user.email

    if (unlockedPasswords[userId]) {
      setUnlockedPasswords((prev) => {
        const copy = { ...prev }
        delete copy[userId]
        return copy
      })
      return
    }

    if (!user.user_codeID) {
      alert('Original password vault token (user_codeID) not available for this account.')
      return
    }

    let adminPwd = sessionStorage.getItem('admin_auth_password') || ''
    if (!adminPwd) {
      adminPwd = prompt('Enter Owner Admin Password to decrypt user_codeID:')
      if (!adminPwd) return
    }

    try {
      setRevealingUserId(userId)
      const res = await axios.post('/api/license/admin/reveal-password', {
        admin_password: adminPwd.trim(),
        user_codeID: user.user_codeID,
      })

      if (res.data?.ok && res.data?.original_password) {
        setUnlockedPasswords((prev) => ({
          ...prev,
          [userId]: res.data.original_password,
        }))
      } else {
        alert(res.data?.error || 'Invalid admin password.')
      }
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to decrypt password: Access Denied.')
    } finally {
      setRevealingUserId(null)
    }
  }

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
    setMaxDevices(license.max_devices !== undefined && license.max_devices !== null ? license.max_devices : 3)
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
        max_devices: Number(maxDevices),
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

  // --- Handlers: Modules & Tabs Permissions Modal ---
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
    setSelectedTabs([])
  }

  const handleSaveTabs = async () => {
    if (!selectedLicense) return
    setActionLoading(selectedLicense.id)

    try {
      const payloadTabs =
        selectedTabs.length === ALL_SIDEBAR_TABS.length ? 'ALL' : selectedTabs

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

  // --- Handlers: Per-User Tab Permissions Modal ---
  const openUserTabsModal = (user) => {
    setEditingUserForTabs(user)
    let tabs = []
    try {
      if (user.allowed_tabs === 'ALL' || !user.allowed_tabs) {
        tabs = ALL_SIDEBAR_TABS.map((t) => t.id)
      } else if (typeof user.allowed_tabs === 'string') {
        const parsed = JSON.parse(user.allowed_tabs)
        tabs = Array.isArray(parsed) ? parsed : ALL_SIDEBAR_TABS.map((t) => t.id)
      } else if (Array.isArray(user.allowed_tabs)) {
        tabs = user.allowed_tabs
      }
    } catch {
      tabs = ALL_SIDEBAR_TABS.map((t) => t.id)
    }
    setUserSpecificTabs(tabs)
    setIsUserTabsModalOpen(true)
  }

  const toggleUserTab = (tabId) => {
    setUserSpecificTabs((prev) =>
      prev.includes(tabId) ? prev.filter((id) => id !== tabId) : [...prev, tabId]
    )
  }

  const selectAllUserTabs = () => {
    setUserSpecificTabs(ALL_SIDEBAR_TABS.map((t) => t.id))
  }

  const clearAllUserTabs = () => {
    setUserSpecificTabs([])
  }

  const handleSaveUserTabs = async () => {
    if (!selectedLicense || !editingUserForTabs) return
    setActionLoading(selectedLicense.id)

    const updatedTabVal =
      userSpecificTabs.length === ALL_SIDEBAR_TABS.length ? 'ALL' : userSpecificTabs

    const updatedUsers = viewingUsers.map((u) =>
      u.id === editingUserForTabs.id ? { ...u, allowed_tabs: updatedTabVal } : u
    )
    setViewingUsers(updatedUsers)

    try {
      await axios.post('/api/license/admin/update', {
        id: selectedLicense.id,
        users_data: updatedUsers,
      })
      setIsUserTabsModalOpen(false)
      fetchLicenses()
      alert(`Tab permissions updated for ${editingUserForTabs.name || editingUserForTabs.email}!`)
    } catch (err) {
      alert(err?.response?.data?.error || err.message || 'Failed to save user tab permissions')
    } finally {
      setActionLoading(null)
    }
  }

  const handleChangeUserRole = async (user, newRole) => {
    if (!selectedLicense || !user) return
    const roleMeta = getRoleMeta(newRole)
    const newTabs = roleMeta.tabs.includes('ALL') ? 'ALL' : roleMeta.tabs

    const updatedUsers = viewingUsers.map((u) => {
      if (u.id === user.id) {
        return {
          ...u,
          user_type: newRole,
          role_assigned_by_admin: true,
          allowed_tabs: (!u.allowed_tabs || u.allowed_tabs === 'ALL') ? newTabs : u.allowed_tabs,
        }
      }
      return u
    })

    setViewingUsers(updatedUsers)
    setActionLoading(selectedLicense.id)

    try {
      await axios.post('/api/license/admin/update', {
        id: selectedLicense.id,
        users_data: updatedUsers,
      })
      fetchLicenses()
    } catch (err) {
      alert(err?.response?.data?.error || err.message || 'Failed to update user role')
    } finally {
      setActionLoading(null)
    }
  }

  const applyRoleDefaultTabs = () => {
    if (!editingUserForTabs) return
    const meta = getRoleMeta(editingUserForTabs.user_type)
    if (meta.tabs.includes('ALL')) {
      setUserSpecificTabs(ALL_SIDEBAR_TABS.map((t) => t.id))
    } else {
      setUserSpecificTabs(meta.tabs)
    }
  }

  // --- Handlers: Connected Devices & Counter PCs Modal ---
  const openDevicesModal = (license) => {
    setSelectedLicense(license)
    let devs = []
    try {
      if (license.devices_data) {
        devs = typeof license.devices_data === 'string' ? JSON.parse(license.devices_data) : license.devices_data
      }
    } catch {
      devs = []
    }
    setViewingDevices(Array.isArray(devs) ? devs : [])
    setDeviceLimitInput(license.max_devices || 3)
    setIsDevicesModalOpen(true)
  }

  const handleSaveDeviceLimit = async () => {
    if (!selectedLicense) return
    setActionLoading(selectedLicense.id)
    try {
      await axios.post('/api/license/admin/update', {
        id: selectedLicense.id,
        max_devices: Number(deviceLimitInput),
      })
      selectedLicense.max_devices = Number(deviceLimitInput)
      fetchLicenses()
      alert('Device limit updated successfully!')
    } catch (err) {
      alert(err?.response?.data?.error || err.message || 'Failed to update device limit')
    } finally {
      setActionLoading(null)
    }
  }

  const handleToggleDeviceStatus = async (dev) => {
    if (!selectedLicense) return
    const nextStatus = dev.status === 'blocked' ? 'active' : 'blocked'
    const updatedDevs = viewingDevices.map((d) =>
      d.device_id === dev.device_id ? { ...d, status: nextStatus } : d
    )
    setViewingDevices(updatedDevs)
    setActionLoading(selectedLicense.id)
    try {
      await axios.post('/api/license/admin/update', {
        id: selectedLicense.id,
        devices_data: updatedDevs,
      })
      fetchLicenses()
    } catch (err) {
      alert(err?.response?.data?.error || err.message || 'Failed to update device status')
    } finally {
      setActionLoading(null)
    }
  }

  const handleChangeDeviceRole = async (dev, newRole) => {
    if (!selectedLicense) return
    const updatedDevs = viewingDevices.map((d) =>
      d.device_id === dev.device_id ? { ...d, device_role: newRole } : d
    )
    setViewingDevices(updatedDevs)
    setActionLoading(selectedLicense.id)
    try {
      await axios.post('/api/license/admin/update', {
        id: selectedLicense.id,
        devices_data: updatedDevs,
      })
      fetchLicenses()
    } catch (err) {
      alert(err?.response?.data?.error || err.message || 'Failed to change role')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteDevice = async (dev) => {
    if (!selectedLicense) return
    if (!confirm(`Disconnect and remove computer "${dev.device_name || dev.device_id}"? This will free up 1 device slot.`)) return
    const updatedDevs = viewingDevices.filter((d) => d.device_id !== dev.device_id)
    setViewingDevices(updatedDevs)
    setActionLoading(selectedLicense.id)
    try {
      await axios.post('/api/license/admin/update', {
        id: selectedLicense.id,
        devices_data: updatedDevs,
      })
      fetchLicenses()
    } catch (err) {
      alert(err?.response?.data?.error || err.message || 'Failed to remove device')
    } finally {
      setActionLoading(null)
    }
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
      return 'Lifetime'
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="bg-gradient-to-r from-[#07502f] to-[#04331e] rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🦓</span>
            <h2 className="text-xl font-black tracking-tight">
              Zebra IMS • Client Licenses & Multi-PC Nodes
            </h2>
          </div>
          <p className="text-xs text-emerald-200/90 font-medium">
            Control activation approvals, device & counter PC limits, credentials, and per-user module tabs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchLicenses}
            disabled={loading}
            className="px-4 py-2 bg-emerald-600/80 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs backdrop-blur-sm transition-all flex items-center gap-1.5 shadow"
          >
            <span>{loading ? 'Refreshing...' : '🔄 Refresh Data'}</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Clients', count: stats.total, color: 'border-gray-200 text-gray-800' },
          { label: 'Pending Approvals', count: stats.pending, color: 'border-amber-300 bg-amber-50/50 text-amber-900', badge: stats.pending > 0 },
          { label: 'Active Licenses', count: stats.active, color: 'border-emerald-300 bg-emerald-50/50 text-emerald-900' },
          { label: 'Suspended (Locked)', count: stats.suspended, color: 'border-rose-300 bg-rose-50/50 text-rose-900' },
          { label: 'Expired', count: stats.expired, color: 'border-gray-300 bg-gray-50 text-gray-600' },
          { label: 'Rejected', count: stats.rejected, color: 'border-red-300 bg-red-50 text-red-700' },
        ].map((item, idx) => (
          <div
            key={idx}
            className={`p-3.5 rounded-2xl border bg-white shadow-sm flex flex-col justify-between ${item.color}`}
          >
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center justify-between">
              {item.label}
              {item.badge && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              )}
            </span>
            <span className="text-2xl font-black mt-2">{item.count}</span>
          </div>
        ))}
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-200 shadow-sm text-xs">
        <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All Clients' },
            { id: 'pending', label: `Pending (${stats.pending})` },
            { id: 'active', label: `Active (${stats.active})` },
            { id: 'suspended', label: `Suspended (${stats.suspended})` },
            { id: 'other', label: 'Expired / Other' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                filter === tab.id
                  ? 'bg-emerald-800 text-white shadow-sm'
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
            placeholder="Search company, MAC, key, city..."
            className="w-full px-3 py-1.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
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
                <th className="py-3 px-4 font-semibold">Connected PCs</th>
                <th className="py-3 px-4 font-semibold">Users</th>
                <th className="py-3 px-4 font-semibold">Modules</th>
                <th className="py-3 px-4 font-semibold">Expiration</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-gray-500">
                    Loading clients...
                  </td>
                </tr>
              ) : filteredLicenses.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-gray-400">
                    No clients match this filter.
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

                  let parsedDevices = []
                  try {
                    parsedDevices = typeof item.devices_data === 'string' ? JSON.parse(item.devices_data) : item.devices_data || []
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

                      {/* Connected PCs / Devices Limit */}
                      <td className="py-3 px-4 align-middle">
                        <button
                          type="button"
                          onClick={() => openDevicesModal(item)}
                          className="hover:underline font-semibold text-gray-800 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 hover:bg-sky-100 transition-colors"
                          title="Click to view & manage connected Counter/Server PCs"
                        >
                          <span>💻</span>
                          <span className="font-extrabold text-sky-900">{parsedDevices.length}</span>
                          <span className="text-gray-400">/</span>
                          <span className="font-bold text-sky-700">{item.max_devices || 3}</span>
                          <span className="text-[10px] text-sky-600 font-bold ml-1">PCs</span>
                        </button>
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
                        {parsedUsers.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Array.from(new Set(parsedUsers.map((u) => u.user_type || 'Employee')))
                              .slice(0, 3)
                              .map((roleName, rIdx) => {
                                const meta = getRoleMeta(roleName)
                                return (
                                  <span
                                    key={rIdx}
                                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold border ${meta.badge}`}
                                  >
                                    <span>{meta.icon}</span>
                                    <span>{meta.shortLabel}</span>
                                  </span>
                                )
                              })}
                            {new Set(parsedUsers.map((u) => u.user_type || 'Employee')).size > 3 && (
                              <span className="text-[9px] text-gray-400 font-bold self-center">
                                +more
                              </span>
                            )}
                          </div>
                        )}
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
                  placeholder="e.g. Habib Rice Corporation"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Limits Row: Users and Connected PCs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Max Connected PCs */}
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    💻 Max Connected PCs (LAN)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={maxDevices}
                    onChange={(e) => setMaxDevices(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 font-bold"
                  />
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    Total computers (Server + Counters).
                  </span>
                </div>

                {/* Max Users Limit */}
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    👥 Max Login Users
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={maxUsers}
                    onChange={(e) => setMaxUsers(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 font-bold"
                  />
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    User logins client can create.
                  </span>
                </div>
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

      {/* 2. Modal: Global Client Module / Tab Permissions */}
      {isTabsModalOpen && selectedLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-6 space-y-4 border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  📑 Client Global Module Permissions
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
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl p-6 space-y-4 border border-gray-100 max-h-[90vh] overflow-y-auto">
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
                      <th className="py-2.5 px-3">Sidebar Tabs</th>
                      <th className="py-2.5 px-3">Password / Access</th>
                      <th className="py-2.5 px-3 text-right">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {viewingUsers.map((u, i) => {
                      let userTabCount = ALL_SIDEBAR_TABS.length
                      if (u.allowed_tabs && u.allowed_tabs !== 'ALL') {
                        try {
                          const parsed = Array.isArray(u.allowed_tabs) ? u.allowed_tabs : JSON.parse(u.allowed_tabs)
                          userTabCount = parsed.length
                        } catch {}
                      }

                      return (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="py-2 px-3 font-bold text-gray-800">{u.name || '—'}</td>
                          <td className="py-2 px-3 font-mono text-gray-600">{u.email || '—'}</td>
                          <td className="py-2 px-3">
                            <div className="relative inline-block">
                              <select
                                value={u.user_type || 'Employee'}
                                onChange={(e) => handleChangeUserRole(u, e.target.value)}
                                disabled={actionLoading === selectedLicense?.id}
                                className={`text-[11px] font-bold pl-2.5 pr-6 py-1 rounded-lg border appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all ${
                                  getRoleMeta(u.user_type).badge
                                }`}
                                title="Click to change this user's role on the server"
                              >
                                {Object.values(ROLE_DEFINITIONS).map((r) => (
                                  <option
                                    key={r.key}
                                    value={r.key}
                                    className="bg-white text-gray-900 font-semibold py-1"
                                  >
                                    {r.label}
                                  </option>
                                ))}
                              </select>
                              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-gray-500 text-[9px]">
                                ▼
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <button
                              type="button"
                              onClick={() => openUserTabsModal(u)}
                              className="px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold hover:bg-indigo-100 text-[11px] flex items-center gap-1 transition-colors"
                              title="Click to customize enabled tabs for this user account"
                            >
                              <span>📑</span>
                              <span>
                                {u.allowed_tabs === 'ALL' || !u.allowed_tabs
                                  ? 'All 20 Tabs'
                                  : `${userTabCount} Tabs`}
                              </span>
                            </button>
                          </td>
                          <td className="py-2 px-3">
                            {unlockedPasswords[u.id || u.email] ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(unlockedPasswords[u.id || u.email], `pwd_${i}`)}
                                  className="font-mono bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1 shadow-sm"
                                  title="Decrypted original password (Click to copy)"
                                >
                                  <span>🔓 {unlockedPasswords[u.id || u.email]}</span>
                                  <span>{copiedKey === `pwd_${i}_${unlockedPasswords[u.id || u.email]}` ? '✓' : '📋'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRevealPassword(u)}
                                  className="text-[10px] text-gray-500 hover:text-gray-700 underline"
                                  title="Hide password"
                                >
                                  Hide
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-gray-400 text-xs tracking-widest select-none">••••••••</span>
                                {u.user_codeID ? (
                                  <button
                                    type="button"
                                    onClick={() => handleRevealPassword(u)}
                                    disabled={revealingUserId === (u.id || u.email)}
                                    className="px-2 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold flex items-center gap-1 transition-all"
                                    title="Unlock original password using admin password"
                                  >
                                    {revealingUserId === (u.id || u.email) ? '...' : '👁️ Unlock'}
                                  </button>
                                ) : u.password ? (
                                  <span className="text-[10px] text-gray-400 font-mono" title="Password Hash / Encoded">
                                    🔒 Hash
                                  </span>
                                ) : (
                                  <span className="text-gray-400 font-mono">—</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right text-gray-500 text-[11px]">
                            {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      )
                    })}
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

      {/* 4. Modal: Per-User Specific Tab Permissions */}
      {isUserTabsModalOpen && editingUserForTabs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-6 space-y-4 border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  📑 Custom Tabs for: {editingUserForTabs.name || editingUserForTabs.email}
                </h3>
                <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                  <span>Role:</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${getRoleMeta(editingUserForTabs.user_type).badge}`}>
                    {getRoleMeta(editingUserForTabs.user_type).icon} {getRoleMeta(editingUserForTabs.user_type).label}
                  </span>
                  <span>• Only checked tabs will appear in their sidebar.</span>
                </p>
              </div>
              <button
                onClick={() => setIsUserTabsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ×
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-indigo-50 p-2.5 rounded-xl border border-indigo-200 text-xs gap-2">
              <span className="font-semibold text-indigo-900">
                Enabled for User: <strong className="text-indigo-700">{userSpecificTabs.length} / {ALL_SIDEBAR_TABS.length}</strong>
              </span>
              <div className="space-x-2 flex items-center">
                <button
                  type="button"
                  onClick={applyRoleDefaultTabs}
                  className="px-2.5 py-1 bg-white border border-indigo-200 text-indigo-700 rounded-lg font-bold hover:bg-indigo-100 text-xs shadow-sm flex items-center gap-1"
                  title={`Apply default tabs for ${getRoleMeta(editingUserForTabs.user_type).shortLabel}`}
                >
                  <span>⚡</span>
                  <span>{getRoleMeta(editingUserForTabs.user_type).shortLabel} Defaults</span>
                </button>
                <button
                  type="button"
                  onClick={selectAllUserTabs}
                  className="px-2.5 py-1 bg-white border rounded-lg font-bold text-gray-700 hover:bg-gray-100"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={clearAllUserTabs}
                  className="px-2.5 py-1 bg-white border rounded-lg font-bold text-red-600 hover:bg-red-50"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {ALL_SIDEBAR_TABS.map((tab) => {
                const checked = userSpecificTabs.includes(tab.id)
                return (
                  <label
                    key={tab.id}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                      checked
                        ? 'border-indigo-500 bg-indigo-50/60 font-bold text-gray-900'
                        : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleUserTab(tab.id)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
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
                onClick={() => setIsUserTabsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-gray-700 hover:bg-gray-100 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveUserTabs}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow"
              >
                Save User Permissions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Modal: Connected Devices & Counter PCs */}
      {isDevicesModalOpen && selectedLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl p-6 space-y-4 border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span>💻</span>
                  <span>Connected Devices & Counter PCs</span>
                </h3>
                <p className="text-xs text-gray-500">
                  Client: <strong className="text-gray-800">{selectedLicense.company_name || selectedLicense.customer_name || selectedLicense.hostname}</strong> ({selectedLicense.city || 'Local LAN'})
                </p>
              </div>
              <button
                onClick={() => setIsDevicesModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Quick Limit Setter Header */}
            <div className="flex flex-col sm:flex-row items-center justify-between bg-sky-50 border border-sky-200 p-3 rounded-xl text-xs gap-3">
              <div>
                <span className="font-bold text-sky-950 block">
                  Connected Computers: <strong className="text-sky-700">{viewingDevices.length}</strong> / Allowed Limit: <strong className="text-sky-700">{selectedLicense.max_devices || 3}</strong>
                </span>
                <span className="text-[11px] text-sky-700">
                  Offline multi-PC architecture: Only authorized computers up to this limit can connect.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <label className="font-bold text-gray-700 text-xs whitespace-nowrap">
                  Allowed Limit:
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={deviceLimitInput}
                  onChange={(e) => setDeviceLimitInput(e.target.value)}
                  className="w-16 px-2 py-1 rounded-lg border border-sky-300 font-bold text-center text-xs"
                />
                <button
                  type="button"
                  onClick={handleSaveDeviceLimit}
                  className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-lg text-xs transition-colors shrink-0"
                >
                  Update Limit
                </button>
              </div>
            </div>

            {viewingDevices.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-xs">
                No computers reported yet. Counter and Server PCs will appear automatically when connected on the local LAN.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100 text-gray-700 font-bold">
                    <tr>
                      <th className="py-2.5 px-3">Computer Name</th>
                      <th className="py-2.5 px-3">Role / Desk</th>
                      <th className="py-2.5 px-3">IP & MAC Address</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Last Active</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {viewingDevices.map((dev, idx) => {
                      const isServer = dev.device_role === 'Server'
                      const isBlocked = dev.status === 'blocked'

                      return (
                        <tr key={idx} className={`hover:bg-gray-50 ${isBlocked ? 'bg-rose-50/40' : ''}`}>
                          <td className="py-2.5 px-3 font-bold text-gray-900">
                            <div className="flex items-center gap-1.5">
                              <span>{isServer ? '🖧' : '💻'}</span>
                              <span>{dev.device_name || `Computer ${idx + 1}`}</span>
                            </div>
                            <div className="text-[10px] text-gray-400 font-mono mt-0.5 truncate max-w-[140px]" title={dev.device_id}>
                              ID: {dev.device_id?.slice(0, 14)}...
                            </div>
                          </td>

                          <td className="py-2.5 px-3">
                            <select
                              value={dev.device_role || 'Counter'}
                              onChange={(e) => handleChangeDeviceRole(dev, e.target.value)}
                              className="px-2 py-1 rounded-lg border border-gray-300 font-semibold text-[11px] bg-white focus:ring-1 focus:ring-sky-500"
                            >
                              <option value="Server">Server PC</option>
                              <option value="Counter">Counter PC</option>
                              <option value="Gate">Gate Pass</option>
                              <option value="Cashier">Cashier Desk</option>
                              <option value="Manager">Manager PC</option>
                            </select>
                          </td>

                          <td className="py-2.5 px-3 font-mono text-[11px] text-gray-600">
                            <div>{dev.ip_address || '127.0.0.1'}</div>
                            <div className="text-[10px] text-gray-400">{dev.mac_address || '—'}</div>
                          </td>

                          <td className="py-2.5 px-3">
                            {isBlocked ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                                Blocked
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                Active
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-gray-500 text-[11px]">
                            {dev.last_seen_at ? new Date(dev.last_seen_at).toLocaleDateString() : '—'}
                          </td>

                          <td className="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleToggleDeviceStatus(dev)}
                              className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-colors ${
                                isBlocked
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                              }`}
                              title={isBlocked ? 'Click to unblock computer' : 'Click to block computer'}
                            >
                              {isBlocked ? '🔓 Unblock' : '🔒 Block'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteDevice(dev)}
                              className="px-2 py-1 rounded-lg text-gray-400 hover:text-red-600 font-bold text-[11px] transition-colors"
                              title="Disconnect / Remove computer to free up a slot"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-end pt-3 border-t">
              <button
                type="button"
                onClick={() => setIsDevicesModalOpen(false)}
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
