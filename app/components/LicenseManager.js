'use client'

import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { ROLE_DEFINITIONS, getRoleMeta } from '@/lib/roles'

export const CORE_SIDEBAR_TABS = [
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

export const ADVANCED_SIDEBAR_TABS = [
  { id: 'AI Advisor', label: 'AI Business Advisor', icon: '🤖', category: 'Enterprise AI', isAdvanced: true },
  { id: 'Quotations', label: 'Quotations & Sales Orders', icon: '📑', category: 'Advanced Sales', isAdvanced: true },
  { id: 'Live Excel', label: 'Spreadsheet Excel Sync', icon: '📊', category: 'Integrations', isAdvanced: true },
  { id: 'Auto Backup', label: 'Automated Cloud Backup', icon: '🔄', category: 'Security & Backup', isAdvanced: true },
]

export const ALL_SIDEBAR_TABS = [...CORE_SIDEBAR_TABS, ...ADVANCED_SIDEBAR_TABS]

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
  const [licenseGeminiKey, setLicenseGeminiKey] = useState('')
  const [licenseGeminiKeyName, setLicenseGeminiKeyName] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)

  // 2. Tabs Permissions Modal state
  const [isTabsModalOpen, setIsTabsModalOpen] = useState(false)
  const [selectedTabs, setSelectedTabs] = useState([])
  const [allowUpdatesModal, setAllowUpdatesModal] = useState(true)

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

  // 7. Per-Client Google Gemini Key Modal state
  const [isGeminiModalOpen, setIsGeminiModalOpen] = useState(false)
  const [geminiLicense, setGeminiLicense] = useState(null)
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState('')
  const [geminiKeyNameInput, setGeminiKeyNameInput] = useState('')
  const [geminiTesting, setGeminiTesting] = useState(false)
  const [geminiTestStatus, setGeminiTestStatus] = useState(null)
  const [geminiSaving, setGeminiSaving] = useState(false)

  // View mode: 'cards' (rich detailed view) | 'table' (compact spreadsheet view)
  const [viewMode, setViewMode] = useState('cards')
  const [copiedKeyId, setCopiedKeyId] = useState('')

  const handleCopyText = (text, id) => {
    if (!text) return
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text)
      setCopiedKeyId(id)
      setTimeout(() => setCopiedKeyId(''), 2500)
    }
  }

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

    let totalPCs = 0
    let totalUsers = 0
    let customAiCount = 0

    licenses.forEach((l) => {
      try {
        const d = typeof l.devices_data === 'string' ? JSON.parse(l.devices_data) : l.devices_data || []
        totalPCs += Array.isArray(d) ? d.length : 0
      } catch {}
      try {
        const u = typeof l.users_data === 'string' ? JSON.parse(l.users_data) : l.users_data || []
        totalUsers += Array.isArray(u) ? u.length : 0
      } catch {}
      if (l.gemini_api_key && l.gemini_api_key.trim()) {
        customAiCount += 1
      }
    })

    return { total, pending, active, suspended, expired, rejected, totalPCs, totalUsers, customAiCount }
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
    setLicenseGeminiKey(license.gemini_api_key || '')
    setLicenseGeminiKeyName(license.gemini_key_name || '')
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
        gemini_api_key: licenseGeminiKey.trim(),
        gemini_key_name: licenseGeminiKeyName.trim(),
      })
      setIsModalOpen(false)
      fetchLicenses()
    } catch (err) {
      alert(err?.response?.data?.error || err.message || 'Failed to update device license')
    } finally {
      setActionLoading(null)
    }
  }

  // --- Handlers: Dedicated Per-Client Gemini Key Modal ---
  const openGeminiModal = (license) => {
    setGeminiLicense(license)
    setGeminiApiKeyInput(license.gemini_api_key || '')
    setGeminiKeyNameInput(license.gemini_key_name || '')
    setGeminiTestStatus(null)
    setIsGeminiModalOpen(true)
  }

  const handleTestGeminiKey = async () => {
    const keyToTest = geminiApiKeyInput.trim()
    if (!keyToTest) {
      setGeminiTestStatus({ success: false, message: 'Please enter a Gemini API Key first.' })
      return
    }
    setGeminiTesting(true)
    setGeminiTestStatus(null)
    try {
      const res = await axios.post('/api/license/admin/test-gemini', {
        api_key: keyToTest,
      })
      if (res.data?.ok) {
        setGeminiTestStatus({
          success: true,
          message: `Key is valid! Model: ${res.data.model || 'Gemini 3.5 Flash'}`,
        })
      } else {
        setGeminiTestStatus({
          success: false,
          message: res.data?.error || 'Gemini API Key rejected by Google.',
        })
      }
    } catch (err) {
      setGeminiTestStatus({
        success: false,
        message: err?.response?.data?.error || err.message || 'Key verification failed.',
      })
    } finally {
      setGeminiTesting(false)
    }
  }

  const handleSaveGeminiKey = async () => {
    if (!geminiLicense) return
    setGeminiSaving(true)
    try {
      const res = await axios.post('/api/license/admin/update', {
        id: geminiLicense.id,
        gemini_api_key: geminiApiKeyInput.trim(),
        gemini_key_name: geminiKeyNameInput.trim(),
      })
      if (res.data?.ok) {
        setIsGeminiModalOpen(false)
        fetchLicenses()
      } else {
        alert(res.data?.error || 'Failed to save Gemini API Key.')
      }
    } catch (err) {
      alert(err?.response?.data?.error || err.message || 'Error saving Gemini API key.')
    } finally {
      setGeminiSaving(false)
    }
  }

  // --- Handlers: Modules & Tabs Permissions Modal ---
  const openTabsModal = (license) => {
    setSelectedLicense(license)
    let tabs = []
    try {
      if (license.allowed_tabs === 'ALL' || !license.allowed_tabs) {
        tabs = CORE_SIDEBAR_TABS.map((t) => t.id)
      } else if (typeof license.allowed_tabs === 'string') {
        const parsed = JSON.parse(license.allowed_tabs)
        tabs = Array.isArray(parsed) ? parsed : CORE_SIDEBAR_TABS.map((t) => t.id)
      } else if (Array.isArray(license.allowed_tabs)) {
        tabs = license.allowed_tabs
      }
    } catch {
      tabs = CORE_SIDEBAR_TABS.map((t) => t.id)
    }
    setSelectedTabs(tabs)
    setAllowUpdatesModal(license.allow_updates !== false)
    setIsTabsModalOpen(true)
  }

  const toggleTab = (tabId) => {
    setSelectedTabs((prev) =>
      prev.includes(tabId) ? prev.filter((id) => id !== tabId) : [...prev, tabId]
    )
  }

  const selectAllCoreTabs = () => {
    setSelectedTabs(CORE_SIDEBAR_TABS.map((t) => t.id))
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
      const isExactCoreOnly =
        selectedTabs.length === CORE_SIDEBAR_TABS.length &&
        selectedTabs.every((id) => CORE_SIDEBAR_TABS.some((c) => c.id === id))

      const payloadTabs = isExactCoreOnly ? 'ALL' : selectedTabs

      await axios.post('/api/license/admin/update', {
        id: selectedLicense.id,
        allowed_tabs: payloadTabs,
        allow_updates: allowUpdatesModal,
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

  const selectAllUserCoreTabs = () => {
    setUserSpecificTabs(CORE_SIDEBAR_TABS.map((t) => t.id))
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
      {/* Top Banner / Executive Header */}
      <div className="bg-gradient-to-r from-[#042014] via-[#073d27] to-[#042014] rounded-3xl p-6 sm:p-7 text-white shadow-xl border border-emerald-500/20 flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-lg">
              🛡️
            </span>
            <span className="text-[11px] font-black uppercase tracking-widest text-emerald-300 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
              Fleet Commander
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Client Licenses & Multi-PC Nodes
          </h2>
          <p className="text-xs text-emerald-200/80 font-medium max-w-2xl mt-1 leading-relaxed">
            Centralized remote control for instant activation approvals, hardware device locking (MAC + UUID), counter seat quotas, employee credentials, and per-client Google Gemini AI keys.
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10 shrink-0">
          <button
            type="button"
            onClick={fetchLicenses}
            disabled={loading}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs transition-all flex items-center gap-2 shadow-lg shadow-emerald-950/40 disabled:opacity-50"
          >
            <span className={loading ? 'animate-spin' : ''}>🔄</span>
            <span>{loading ? 'Refreshing...' : 'Refresh Fleet Data'}</span>
          </button>
        </div>

        {/* Subtle decorative glow */}
        <div className="absolute right-0 top-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* 5 High-Impact Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total Organizations */}
        <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-sm flex flex-col justify-between hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[11px] font-extrabold uppercase tracking-wider">Organizations</span>
            <span className="text-lg">🏢</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-gray-900">{stats.total}</div>
            <div className="text-[11px] font-semibold text-emerald-700 mt-1 flex items-center gap-1.5">
              <span>● {stats.active} Active</span>
              <span className="text-gray-300">•</span>
              <span className="text-amber-600">● {stats.pending} Pending</span>
            </div>
          </div>
        </div>

        {/* Pending Approvals */}
        <div
          className={`p-4 rounded-2xl border shadow-sm flex flex-col justify-between transition-all ${
            stats.pending > 0
              ? 'bg-amber-50/70 border-amber-300 text-amber-950'
              : 'bg-white border-gray-200 text-gray-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-800">
              Pending Approvals
            </span>
            <span className="text-lg">⏳</span>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl sm:text-3xl font-black text-amber-900">{stats.pending}</span>
              {stats.pending > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
              )}
            </div>
            <div className="text-[11px] font-semibold text-amber-700 mt-1">
              {stats.pending > 0 ? 'Requires Owner Action' : 'All Requests Approved ✓'}
            </div>
          </div>
        </div>

        {/* Multi-PC Nodes */}
        <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-sm flex flex-col justify-between hover:border-sky-300 transition-all">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[11px] font-extrabold uppercase tracking-wider">Multi-PC Nodes</span>
            <span className="text-lg">💻</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-gray-900">{stats.totalPCs}</div>
            <div className="text-[11px] font-semibold text-sky-700 mt-1">
              Server & Counter PCs Active
            </div>
          </div>
        </div>

        {/* Staff & Users */}
        <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-sm flex flex-col justify-between hover:border-purple-300 transition-all">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[11px] font-extrabold uppercase tracking-wider">Staff Accounts</span>
            <span className="text-lg">👥</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-gray-900">{stats.totalUsers}</div>
            <div className="text-[11px] font-semibold text-purple-700 mt-1">
              Admins, Cashiers & Operators
            </div>
          </div>
        </div>

        {/* Gemini AI Deployments */}
        <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-sm flex flex-col justify-between hover:border-indigo-300 transition-all col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[11px] font-extrabold uppercase tracking-wider">Gemini AI Keys</span>
            <span className="text-lg">🤖</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-gray-900">{stats.customAiCount}</div>
            <div className="text-[11px] font-semibold text-indigo-700 mt-1">
              Custom Isolated Keys Active
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar: Filter Pills, Search Bar & View Mode Toggle */}
      <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-3 text-xs">
        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0">
          {[
            { id: 'all', label: 'All Organizations', count: stats.total },
            { id: 'pending', label: 'Pending Review', count: stats.pending, isAlert: stats.pending > 0 },
            { id: 'active', label: 'Active Licensed', count: stats.active },
            { id: 'suspended', label: 'Suspended (Locked)', count: stats.suspended },
            { id: 'other', label: 'Expired / Other', count: stats.expired + stats.rejected },
          ].map((tab) => {
            const isSelected = filter === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#042014] text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    isSelected
                      ? 'bg-emerald-600 text-white font-extrabold'
                      : tab.isAlert
                      ? 'bg-amber-100 text-amber-800 font-extrabold'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Search Input & View Mode Switcher */}
        <div className="flex items-center gap-2.5 w-full lg:w-auto justify-between lg:justify-end">
          <div className="relative flex-1 lg:w-72">
            <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search business, MAC, key, city..."
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-gray-200 text-xs text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-gray-50/50"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2 text-xs text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* View Mode Toggle: Cards vs Table */}
          <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'cards'
                  ? 'bg-white text-emerald-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              title="Expanded detailed cards view — each feature clearly visible"
            >
              <span>📋</span>
              <span className="hidden sm:inline">Cards View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'table'
                  ? 'bg-white text-emerald-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              title="Spreadsheet table view"
            >
              <span>📊</span>
              <span className="hidden sm:inline">Table View</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main View: Cards View or Table View */}
      {filteredLicenses.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-12 text-center space-y-3">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl mx-auto flex items-center justify-center text-3xl">
            🔍
          </div>
          <h3 className="text-base font-bold text-gray-800">No client organizations found</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            {searchTerm
              ? `No client matches search term "${searchTerm}". Try searching by machine ID or clear filters.`
              : 'There are no client records matching this filter.'}
          </p>
        </div>
      ) : viewMode === 'cards' ? (
        /* ===============================================================
           DETAILED CARDS VIEW: Every single feature prominent & clear
           =============================================================== */
        <div className="space-y-5">
          {filteredLicenses.map((item) => {
            const isPending = item.status === 'pending'
            const isActive = item.status === 'active'
            const isSuspended = item.status === 'suspended'

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

            const isMac = (item.os_info || '').toLowerCase().includes('darwin') || (item.os_info || '').toLowerCase().includes('mac')
            const isWindows = (item.os_info || '').toLowerCase().includes('win')

            return (
              <div
                key={item.id}
                className="bg-white rounded-3xl border border-gray-200/90 shadow-md hover:shadow-lg transition-all overflow-hidden"
              >
                {/* 1. Card Header: Company, Location, Status, and Main Actions */}
                <div className="bg-gradient-to-r from-gray-50 via-white to-gray-50 px-6 py-4 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#07502f] to-[#032314] text-white flex items-center justify-center text-xl font-bold shadow-md shrink-0">
                      🏢
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base sm:text-lg font-black text-gray-950 tracking-tight">
                          {item.company_name || item.customer_name || 'Unregistered Client'}
                        </h3>
                        {item.customer_name && item.company_name && (
                          <span className="text-xs text-gray-500 font-semibold">
                            ({item.customer_name})
                          </span>
                        )}

                        {/* Status Badge */}
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wide border shadow-sm ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : isPending
                              ? 'bg-amber-50 text-amber-900 border-amber-300 animate-pulse'
                              : 'bg-rose-50 text-rose-800 border-rose-300'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isActive ? 'bg-emerald-500' : isPending ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                          />
                          <span>{isActive ? 'Active Licensed' : isPending ? 'Pending Approval' : 'Suspended (Locked)'}</span>
                        </span>
                      </div>

                      {/* Subtitle / Host info */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 mt-1">
                        <span className="font-semibold flex items-center gap-1">
                          <span>{isMac ? '🍏' : isWindows ? '🪟' : '💻'}</span>
                          <span>{item.hostname || 'Unknown Host'}</span>
                        </span>
                        {item.contact && (
                          <>
                            <span className="text-gray-300">•</span>
                            <span className="flex items-center gap-1 text-gray-700 font-semibold">
                              <span>📞</span>
                              <span>{item.contact}</span>
                            </span>
                          </>
                        )}
                        {item.city && (
                          <>
                            <span className="text-gray-300">•</span>
                            <span className="flex items-center gap-1 text-gray-700">
                              <span>📍</span>
                              <span>{item.city}</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Header Actions */}
                  <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => openActivateModal(item)}
                      disabled={actionLoading === item.id}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-sm transition-all flex items-center gap-1.5"
                    >
                      <span>⚙️</span>
                      <span>{isPending ? 'Activate Client' : 'Manage Plan & Limits'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleSuspend(item)}
                      disabled={actionLoading === item.id}
                      className={`px-3 py-1.5 rounded-xl font-extrabold text-xs transition-all border flex items-center gap-1.5 ${
                        isSuspended
                          ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                      }`}
                      title={isSuspended ? 'Resume client access' : 'Lock client screen with suspension notice'}
                    >
                      <span>{isSuspended ? '🔓' : '🔒'}</span>
                      <span>{isSuspended ? 'Resume Access' : 'Lockout Client'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      disabled={actionLoading === item.id}
                      className="p-1.5 rounded-xl text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Permanently delete client record"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* 2. Card Body: 4 High-Visibility Quadrants */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 text-xs">
                  {/* Quadrant 1: Hardware & Activation Security */}
                  <div className="bg-gray-50/70 p-4 rounded-2xl border border-gray-200/80 space-y-2.5">
                    <div className="flex items-center justify-between text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                      <span>Hardware Security</span>
                      <span>🔐</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-gray-500 block font-semibold">Activation Key:</span>
                      <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-xl border border-gray-200 mt-0.5">
                        <span className="font-mono font-bold text-gray-900 tracking-wider">
                          {item.activation_key || 'UNASSIGNED'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyText(item.activation_key, `act_${item.id}`)}
                          className="text-[10px] font-extrabold text-emerald-700 hover:text-emerald-900 ml-1"
                        >
                          {copiedKeyId === `act_${item.id}` ? '✓ Copied' : '📋 Copy'}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-[10px] text-gray-500 block font-semibold">MAC Address:</span>
                        <span className="font-mono font-bold text-gray-800 bg-white px-2 py-0.5 rounded-lg border border-gray-200 block truncate">
                          {item.mac_address || 'UNKNOWN'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 block font-semibold">Expiry Date:</span>
                        <span className="font-semibold text-gray-800 bg-white px-2 py-0.5 rounded-lg border border-gray-200 block">
                          {formatDate(item.expires_at)}
                        </span>
                      </div>
                    </div>

                    <div className="pt-1">
                      <span className="text-[10px] text-gray-400 block truncate font-mono" title={item.machine_id}>
                        UUID: {item.machine_id || 'SYS-DEFAULT'}
                      </span>
                    </div>
                  </div>

                  {/* Quadrant 2: Multi-PC Seats & Counter Network */}
                  <div className="bg-sky-50/50 p-4 rounded-2xl border border-sky-200/80 space-y-2.5">
                    <div className="flex items-center justify-between text-sky-900 font-bold uppercase tracking-wider text-[10px]">
                      <span>Multi-PC Network</span>
                      <span>💻</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-sm text-sky-950">
                        {parsedDevices.length} / {item.max_devices || 3} Computers Active
                      </span>
                      <span className="text-[10px] font-semibold text-sky-700">
                        {Math.round((parsedDevices.length / (item.max_devices || 3)) * 100)}% Capacity
                      </span>
                    </div>

                    {/* Progress Capacity Bar */}
                    <div className="w-full h-2 bg-sky-200/70 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-sky-600 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, Math.round((parsedDevices.length / (item.max_devices || 3)) * 100))}%`,
                        }}
                      />
                    </div>

                    {/* Mini device pills */}
                    <div className="space-y-1">
                      {parsedDevices.slice(0, 2).map((dev, dIdx) => (
                        <div
                          key={dIdx}
                          className="flex items-center justify-between bg-white px-2 py-1 rounded-lg border border-sky-100 text-[11px]"
                        >
                          <span className="font-semibold text-gray-800 truncate max-w-[130px]">
                            {dev.device_role === 'Server' ? '🖥️' : '💻'} {dev.device_name || 'Desk PC'}
                          </span>
                          <span className="font-mono text-[10px] text-gray-500">
                            {dev.device_role || 'Counter'}
                          </span>
                        </div>
                      ))}
                      {parsedDevices.length > 2 && (
                        <div className="text-[10px] text-sky-700 font-bold text-center">
                          +{parsedDevices.length - 2} more connected PCs
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => openDevicesModal(item)}
                      className="w-full py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-[11px] transition-all shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <span>🖥️</span>
                      <span>Manage PCs & Limits ({parsedDevices.length}) →</span>
                    </button>
                  </div>

                  {/* Quadrant 3: Registered Staff & Cashiers */}
                  <div className="bg-purple-50/50 p-4 rounded-2xl border border-purple-200/80 space-y-2.5">
                    <div className="flex items-center justify-between text-purple-900 font-bold uppercase tracking-wider text-[10px]">
                      <span>Staff & User Accounts</span>
                      <span>👥</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-sm text-purple-950">
                        {parsedUsers.length} / {item.max_users || 5} User Accounts
                      </span>
                      <span className="text-[10px] font-semibold text-purple-700">
                        {parsedUsers.filter(u => (u.user_type || '').toLowerCase() === 'admin').length} Admin
                      </span>
                    </div>

                    {/* Mini users list with roles */}
                    <div className="space-y-1">
                      {parsedUsers.slice(0, 2).map((u, uIdx) => {
                        const meta = getRoleMeta(u.user_type)
                        return (
                          <div
                            key={uIdx}
                            className="flex items-center justify-between bg-white px-2 py-1 rounded-lg border border-purple-100 text-[11px]"
                          >
                            <span className="font-bold text-gray-800 truncate max-w-[120px]">
                              {u.name}
                            </span>
                            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold border ${meta.badge}`}>
                              <span>{meta.icon}</span>
                              <span>{meta.shortLabel}</span>
                            </span>
                          </div>
                        )
                      })}
                      {parsedUsers.length > 2 && (
                        <div className="text-[10px] text-purple-700 font-bold text-center">
                          +{parsedUsers.length - 2} more staff operators
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => openUsersModal(item)}
                      className="w-full py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-[11px] transition-all shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <span>👥</span>
                      <span>View Users & Passwords Vault →</span>
                    </button>
                  </div>

                  {/* Quadrant 4: Modules & Dedicated Gemini AI */}
                  <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200/80 space-y-2.5">
                    <div className="flex items-center justify-between text-emerald-900 font-bold uppercase tracking-wider text-[10px]">
                      <span>ERP Tabs & Gemini AI</span>
                      <span>⚡</span>
                    </div>

                    {/* Modules Tab info */}
                    <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-emerald-100">
                      <div>
                        <span className="font-extrabold text-gray-900 block text-xs">
                          {parsedTabs.length} / 20 Modules Active
                        </span>
                        <span className="text-[10px] text-gray-500 font-medium">
                          {item.allow_updates !== false ? '✓ Updates Allowed' : '⛔ Updates Blocked'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => openTabsModal(item)}
                        className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-bold text-[10px] rounded-lg transition-colors"
                      >
                        📑 Edit Tabs
                      </button>
                    </div>

                    {/* Gemini AI Status Badge */}
                    <div className="bg-white p-2 rounded-xl border border-emerald-100 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-gray-500 uppercase">AI Advisor Key:</span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[9px] font-extrabold ${
                            item.gemini_api_key
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          <span>{item.gemini_api_key ? '● Custom AI Key' : '● Shared Master'}</span>
                        </span>
                      </div>
                      <div className="font-semibold text-gray-800 text-[11px] truncate">
                        {item.gemini_key_name || (item.gemini_api_key ? 'Configured Client Key' : 'Default Global Key')}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => openGeminiModal(item)}
                      className="w-full py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[11px] transition-all shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <span>🤖</span>
                      <span>Configure Gemini AI Key →</span>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ===============================================================
           TABLE VIEW: Spacious, high-contrast, perfectly organized
           =============================================================== */
        <div className="bg-white rounded-3xl border border-gray-200 shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#042014] text-white uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="py-4 px-4 font-extrabold">Client / Organization</th>
                  <th className="py-4 px-4 font-extrabold">Activation Key & MAC</th>
                  <th className="py-4 px-4 font-extrabold">Status & Expiry</th>
                  <th className="py-4 px-4 font-extrabold">Multi-PC Nodes</th>
                  <th className="py-4 px-4 font-extrabold">Staff Users</th>
                  <th className="py-4 px-4 font-extrabold">Modules & AI Key</th>
                  <th className="py-4 px-4 font-extrabold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-sans">
                {filteredLicenses.map((item) => {
                  const isPending = item.status === 'pending'
                  const isActive = item.status === 'active'
                  const isSuspended = item.status === 'suspended'

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

                  const isMac = (item.os_info || '').toLowerCase().includes('darwin') || (item.os_info || '').toLowerCase().includes('mac')
                  const isWindows = (item.os_info || '').toLowerCase().includes('win')

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-gray-50/80 transition-colors ${
                        isPending ? 'bg-amber-50/40' : isSuspended ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      {/* Organization & Location */}
                      <td className="py-4 px-4 align-middle">
                        <div className="font-black text-gray-950 text-sm">
                          {item.company_name || item.customer_name || 'Unregistered Client'}
                        </div>
                        <div className="text-gray-500 text-[11px] flex items-center gap-1.5 mt-0.5">
                          <span>{isMac ? '🍏' : isWindows ? '🪟' : '💻'}</span>
                          <span className="font-semibold text-gray-700">{item.hostname || 'Unknown Host'}</span>
                        </div>
                        {item.contact && (
                          <div className="text-[11px] text-gray-600 mt-0.5 font-medium">
                            📞 {item.contact} {item.city ? `• 📍 ${item.city}` : ''}
                          </div>
                        )}
                      </td>

                      {/* Activation Key & Hardware MAC */}
                      <td className="py-4 px-4 align-middle">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded-lg border border-gray-200">
                            {item.activation_key || 'UNASSIGNED'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyText(item.activation_key, `act_tbl_${item.id}`)}
                            className="text-[10px] font-extrabold text-emerald-700 hover:text-emerald-900"
                            title="Copy key"
                          >
                            {copiedKeyId === `act_tbl_${item.id}` ? '✓' : '📋'}
                          </button>
                        </div>
                        <div className="font-mono text-[11px] text-gray-500 mt-1">
                          MAC: {item.mac_address || '—'}
                        </div>
                      </td>

                      {/* Status & Validity */}
                      <td className="py-4 px-4 align-middle">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : isPending
                              ? 'bg-amber-100 text-amber-800 animate-pulse'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          <span>●</span>
                          <span>{isActive ? 'Active' : isPending ? 'Pending' : 'Suspended'}</span>
                        </span>
                        <div className="text-[11px] text-gray-600 font-semibold mt-1">
                          {formatDate(item.expires_at)}
                        </div>
                      </td>

                      {/* Multi-PC Nodes */}
                      <td className="py-4 px-4 align-middle">
                        <button
                          type="button"
                          onClick={() => openDevicesModal(item)}
                          className="px-2.5 py-1 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 font-extrabold text-[11px] flex items-center gap-1.5 transition-colors"
                        >
                          <span>💻</span>
                          <span>{parsedDevices.length} / {item.max_devices || 3} PCs</span>
                        </button>
                      </td>

                      {/* Users / Staff */}
                      <td className="py-4 px-4 align-middle">
                        <button
                          type="button"
                          onClick={() => openUsersModal(item)}
                          className="px-2.5 py-1 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800 font-extrabold text-[11px] flex items-center gap-1.5 transition-colors"
                        >
                          <span>👥</span>
                          <span>{parsedUsers.length} / {item.max_users || 5} Users</span>
                        </button>
                      </td>

                      {/* Modules & Dedicated AI Key */}
                      <td className="py-4 px-4 align-middle space-y-1">
                        <button
                          type="button"
                          onClick={() => openTabsModal(item)}
                          className="px-2 py-0.5 rounded-lg bg-gray-100 hover:bg-gray-200 font-semibold text-gray-700 text-[11px] flex items-center gap-1 transition-colors"
                        >
                          <span>📑</span>
                          <span>{parsedTabs.length} / 20 Tabs</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openGeminiModal(item)}
                          className={`px-2 py-0.5 rounded-lg font-semibold text-[10px] flex items-center gap-1 transition-colors ${
                            item.gemini_api_key
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                          }`}
                        >
                          <span>🤖</span>
                          <span>{item.gemini_api_key ? (item.gemini_key_name || 'Custom AI') : 'AI Key'}</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 align-middle text-right space-x-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openActivateModal(item)}
                          disabled={actionLoading === item.id}
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] shadow-sm transition-all"
                        >
                          {isPending ? 'Activate' : '⚙️ Manage'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleSuspend(item)}
                          disabled={actionLoading === item.id}
                          className={`px-2.5 py-1.5 rounded-xl font-extrabold text-[11px] transition-all border ${
                            isSuspended
                              ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                          }`}
                        >
                          {isSuspended ? '🔓 Resume' : '🔒 Lock'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          disabled={actionLoading === item.id}
                          className="px-2 py-1.5 rounded-xl text-gray-400 hover:text-rose-600 font-bold text-[11px] transition-all"
                          title="Delete client record"
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
        </div>
      )}

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

              {/* Client Dedicated Google Gemini AI Key */}
              <div className="bg-indigo-50/60 p-3.5 rounded-2xl border border-indigo-100 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-indigo-950 flex items-center gap-1.5 text-xs">
                    <span>🤖</span>
                    <span>Client Dedicated Google Gemini AI Key</span>
                  </label>
                  <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                    Isolated Key
                  </span>
                </div>
                <input
                  type="password"
                  value={licenseGeminiKey}
                  onChange={(e) => setLicenseGeminiKey(e.target.value)}
                  placeholder="AIzaSy... (Khali chhorne par master key use hogi)"
                  className="w-full px-3 py-2 rounded-xl border border-indigo-200 bg-white font-mono text-xs focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  type="text"
                  value={licenseGeminiKeyName}
                  onChange={(e) => setLicenseGeminiKeyName(e.target.value)}
                  placeholder="Key Note / Project Name (e.g. Gemini Key For IMS)"
                  className="w-full px-3 py-1.5 rounded-xl border border-indigo-200 bg-white text-xs focus:ring-2 focus:ring-indigo-500"
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

            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-gray-50 p-3 rounded-xl border text-xs gap-2">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-gray-600">
                  Core: <strong className="text-emerald-700">{selectedTabs.filter(id => CORE_SIDEBAR_TABS.some(c => c.id === id)).length} / {CORE_SIDEBAR_TABS.length}</strong>
                </span>
                <span className="font-semibold text-gray-600">
                  Enterprise Add-ons: <strong className="text-purple-700">{selectedTabs.filter(id => ADVANCED_SIDEBAR_TABS.some(a => a.id === id)).length} / {ADVANCED_SIDEBAR_TABS.length}</strong>
                </span>
              </div>
              <div className="space-x-1.5 flex items-center flex-wrap">
                <button
                  type="button"
                  onClick={selectAllCoreTabs}
                  className="px-2.5 py-1 bg-white border border-emerald-300 rounded-lg font-bold text-emerald-800 hover:bg-emerald-50 text-[11px]"
                  title="Grant 20 Standard Core Modules only (Default)"
                >
                  ⚡ Core Only (20 Default)
                </button>
                <button
                  type="button"
                  onClick={selectAllTabs}
                  className="px-2.5 py-1 bg-white border border-purple-300 rounded-lg font-bold text-purple-800 hover:bg-purple-50 text-[11px]"
                  title="Grant All Modules including Enterprise Add-ons"
                >
                  🌟 All (+Enterprise)
                </button>
                <button
                  type="button"
                  onClick={clearAllTabs}
                  className="px-2.5 py-1 bg-white border rounded-lg font-bold text-red-600 hover:bg-red-50 text-[11px]"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Section 1: Standard Core Business Modules (20 Tabs) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                  <span>🏢</span>
                  <span>Standard Business Modules (20 Default Tabs)</span>
                </h4>
                <span className="text-[10px] text-gray-400 font-semibold">Active in Standard License</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {CORE_SIDEBAR_TABS.map((tab) => {
                  const checked = selectedTabs.includes(tab.id)
                  return (
                    <label
                      key={tab.id}
                      className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer transition-colors ${
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
                      <span className="flex-1 text-[11px] truncate">{tab.label}</span>
                      <span className="text-[9px] text-gray-400 font-normal">
                        {tab.category}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Section 2: 🌟 Advanced Enterprise Add-ons (4 Optional Modules) */}
            <div className="p-3.5 bg-gradient-to-br from-amber-50/50 via-purple-50/30 to-indigo-50/40 rounded-2xl border-2 border-purple-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
                    <span>🌟</span>
                    <span>Advanced Enterprise Add-ons (Disabled By Default)</span>
                  </h4>
                  <p className="text-[10px] text-purple-700 mt-0.5">
                    Only check these for clients who have purchased Enterprise add-on packages.
                  </p>
                </div>
                <span className="px-2 py-0.5 bg-purple-600 text-white font-black text-[9px] uppercase tracking-wider rounded-full shadow-sm">
                  Add-on
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {ADVANCED_SIDEBAR_TABS.map((tab) => {
                  const checked = selectedTabs.includes(tab.id)
                  return (
                    <label
                      key={tab.id}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border-2 cursor-pointer transition-all ${
                        checked
                          ? 'border-purple-600 bg-purple-100/70 font-extrabold text-purple-950 shadow-sm'
                          : 'border-purple-200/80 bg-white/90 text-gray-600 hover:bg-purple-50/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTab(tab.id)}
                        className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-lg">{tab.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-black truncate">{tab.label}</span>
                          <span className="px-1.5 py-0.2 text-[8px] font-bold bg-amber-100 text-amber-800 rounded">PRO</span>
                        </div>
                        <span className="text-[9px] text-gray-500 block truncate font-normal">
                          {tab.category}
                        </span>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Section 3: 🚀 Software Update Navbar Control */}
            <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                  <span>🚀</span>
                  <span>Client Navbar: &quot;Check for Updates&quot; Button</span>
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  When enabled, client sees the update button in top navbar. Turn OFF to hide updates from this client.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowUpdatesModal}
                  onChange={(e) => setAllowUpdatesModal(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
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
              <div className="space-x-1.5 flex items-center flex-wrap">
                <button
                  type="button"
                  onClick={applyRoleDefaultTabs}
                  className="px-2 py-1 bg-white border border-indigo-300 text-indigo-700 rounded-lg font-bold hover:bg-indigo-100 text-[11px] shadow-sm flex items-center gap-1"
                  title={`Apply default tabs for ${getRoleMeta(editingUserForTabs.user_type).shortLabel}`}
                >
                  <span>⚡</span>
                  <span>{getRoleMeta(editingUserForTabs.user_type).shortLabel} Defaults</span>
                </button>
                <button
                  type="button"
                  onClick={selectAllUserCoreTabs}
                  className="px-2 py-1 bg-white border border-emerald-300 text-emerald-800 rounded-lg font-bold hover:bg-emerald-50 text-[11px]"
                >
                  Core (20)
                </button>
                <button
                  type="button"
                  onClick={selectAllUserTabs}
                  className="px-2 py-1 bg-white border border-purple-300 text-purple-800 rounded-lg font-bold hover:bg-purple-50 text-[11px]"
                >
                  All (+Enterprise)
                </button>
                <button
                  type="button"
                  onClick={clearAllUserTabs}
                  className="px-2 py-1 bg-white border rounded-lg font-bold text-red-600 hover:bg-red-50 text-[11px]"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* User Core Tabs */}
            <div className="space-y-1.5">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-gray-700">
                🏢 Standard Core Modules (20 Tabs)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {CORE_SIDEBAR_TABS.map((tab) => {
                  const checked = userSpecificTabs.includes(tab.id)
                  return (
                    <label
                      key={tab.id}
                      className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer transition-colors ${
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
                      <span className="flex-1 text-[11px] truncate">{tab.label}</span>
                      <span className="text-[9px] text-gray-400 font-normal">
                        {tab.category}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* User Enterprise Add-on Tabs */}
            <div className="p-3 bg-purple-50/40 rounded-xl border border-purple-200 space-y-1.5">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-purple-900 flex items-center gap-1">
                <span>🌟</span>
                <span>Enterprise Add-ons</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {ADVANCED_SIDEBAR_TABS.map((tab) => {
                  const checked = userSpecificTabs.includes(tab.id)
                  return (
                    <label
                      key={tab.id}
                      className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer transition-colors ${
                        checked
                          ? 'border-purple-600 bg-purple-100 font-extrabold text-purple-950'
                          : 'border-purple-200 bg-white text-gray-500 hover:bg-purple-50/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleUserTab(tab.id)}
                        className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-base">{tab.icon}</span>
                      <span className="flex-1 text-[11px] truncate font-bold">{tab.label}</span>
                      <span className="text-[9px] text-purple-700 font-normal">
                        Add-on
                      </span>
                    </label>
                  )
                })}
              </div>
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

      {/* 6. Modal: Dedicated Google Gemini Key Management */}
      {isGeminiModalOpen && geminiLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-4 border border-gray-100">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg shadow-sm">
                  🤖
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Client Google Gemini AI Key
                  </h3>
                  <p className="text-xs text-gray-500">
                    {geminiLicense.customer_name || geminiLicense.company_name || geminiLicense.hostname} ({geminiLicense.mac_address || 'Server'})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsGeminiModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Har client ke liye aap alag Google Gemini API Key assign kar sakte hain. Agar khali chhorain ge tou default Master Key istemal hogi.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Google Gemini API Key
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={geminiApiKeyInput}
                    onChange={(e) => {
                      setGeminiApiKeyInput(e.target.value)
                      setGeminiTestStatus(null)
                    }}
                    placeholder="AQ.Ab8RN6... ya AIzaSy..."
                    className="w-full px-3 py-2 pr-10 rounded-xl border border-gray-300 font-mono text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                  {geminiApiKeyInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setGeminiApiKeyInput('')
                        setGeminiTestStatus(null)
                      }}
                      className="absolute right-2.5 top-2.5 text-xs text-gray-400 hover:text-rose-600 font-bold"
                      title="Clear key"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Key Description / Project Label
                </label>
                <input
                  type="text"
                  value={geminiKeyNameInput}
                  onChange={(e) => setGeminiKeyNameInput(e.target.value)}
                  placeholder="e.g. Gemini API Key For IMS (projects/90016021959)"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {geminiTestStatus && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    geminiTestStatus.success
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border border-rose-200 text-rose-800'
                  }`}
                >
                  <span>{geminiTestStatus.success ? '✅' : '⚠️'}</span>
                  <span className="font-medium">{geminiTestStatus.message}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t">
              <button
                type="button"
                onClick={handleTestGeminiKey}
                disabled={geminiTesting || !geminiApiKeyInput.trim()}
                className="px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                <span>{geminiTesting ? '⏳' : '⚡'}</span>
                <span>{geminiTesting ? 'Verifying Key...' : 'Test Key With Google'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsGeminiModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl border border-gray-300 text-gray-700 text-xs font-bold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveGeminiKey}
                  disabled={geminiSaving}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  <span>{geminiSaving ? 'Saving...' : 'Save Gemini Key'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
