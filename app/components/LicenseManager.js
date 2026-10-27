'use client'

import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

export default function LicenseManager() {
  const [licenses, setLicenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all') // 'all', 'pending', 'active', 'other'
  const [searchTerm, setSearchTerm] = useState('')
  const [actionLoading, setActionLoading] = useState(null)

  // Modal / Edit state
  const [selectedLicense, setSelectedLicense] = useState(null)
  const [expiryOption, setExpiryOption] = useState('1_year') // '1_month', '3_months', '6_months', '1_year', 'lifetime', 'custom'
  const [customDate, setCustomDate] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [notes, setNotes] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
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
    const expired = licenses.filter((l) => l.status === 'expired').length
    const rejected = licenses.filter((l) => l.status === 'rejected').length
    return { total, pending, active, expired, rejected }
  }, [licenses])

  const filteredLicenses = useMemo(() => {
    return licenses.filter((item) => {
      // Status filter
      if (filter === 'pending' && item.status !== 'pending') return false
      if (filter === 'active' && item.status !== 'active') return false
      if (filter === 'other' && !['expired', 'rejected'].includes(item.status)) return false

      // Search filter
      if (!searchTerm) return true
      const term = searchTerm.toLowerCase()
      return (
        item.hostname?.toLowerCase().includes(term) ||
        item.mac_address?.toLowerCase().includes(term) ||
        item.activation_key?.toLowerCase().includes(term) ||
        item.customer_name?.toLowerCase().includes(term) ||
        item.os_info?.toLowerCase().includes(term)
      )
    })
  }, [licenses, filter, searchTerm])

  const openActivateModal = (license) => {
    setSelectedLicense(license)
    setCustomerName(license.customer_name || '')
    setNotes(license.notes || '')
    setExpiryOption('1_year')
    setCustomDate('')
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

  const handleSaveActivation = async () => {
    if (!selectedLicense) return
    setActionLoading(selectedLicense.id)

    try {
      const expiresAt = calculateExpiryDate()
      await axios.post('/api/license/admin/update', {
        id: selectedLicense.id,
        status: 'active',
        expires_at: expiresAt,
        customer_name: customerName.trim(),
        notes: notes.trim(),
      })
      setIsModalOpen(false)
      fetchLicenses()
    } catch (err) {
      alert(err?.response?.data?.error || err.message || 'Failed to activate device')
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (license) => {
    if (!confirm(`Are you sure you want to reject this device (${license.hostname} - ${license.mac_address})?`)) {
      return
    }
    setActionLoading(license.id)
    try {
      await axios.post('/api/license/admin/update', {
        id: license.id,
        status: 'rejected',
      })
      fetchLicenses()
    } catch (err) {
      alert(err?.response?.data?.error || err.message || 'Failed to reject device')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (license) => {
    if (!confirm(`Permanently delete record for ${license.hostname} (${license.mac_address})?`)) {
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
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 w-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              🔐 License & Device Management
            </h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
              Neon Cloud
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Review new computer requests, activate, reject, or manage license expiration dates.
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
            Total Devices
          </span>
          <strong className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-1 block">
            {stats.total}
          </strong>
          <span className="text-xs text-gray-500 mt-0.5 block">Installed Systems</span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-amber-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">
              Pending Approvals
            </span>
            {stats.pending > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
            )}
          </div>
          <strong className="text-2xl sm:text-3xl font-extrabold text-amber-600 mt-1 block">
            {stats.pending}
          </strong>
          <span className="text-xs text-amber-700 font-medium mt-0.5 block">
            Needs your activation
          </span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-emerald-200 shadow-sm">
          <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider block">
            Active Licenses
          </span>
          <strong className="text-2xl sm:text-3xl font-extrabold text-emerald-700 mt-1 block">
            {stats.active}
          </strong>
          <span className="text-xs text-emerald-600 font-medium mt-0.5 block">
            Working Smoothly
          </span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-red-200 shadow-sm">
          <span className="text-xs font-bold text-red-600 uppercase tracking-wider block">
            Expired / Rejected
          </span>
          <strong className="text-2xl sm:text-3xl font-extrabold text-red-600 mt-1 block">
            {stats.expired + stats.rejected}
          </strong>
          <span className="text-xs text-red-500 mt-0.5 block">
            {stats.expired} expired, {stats.rejected} rejected
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-200 shadow-sm">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
              filter === 'all'
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            All Devices ({stats.total})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
              filter === 'pending'
                ? 'bg-amber-500 text-white'
                : 'text-amber-700 hover:bg-amber-50'
            }`}
          >
            Pending ({stats.pending})
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
              filter === 'active'
                ? 'bg-emerald-600 text-white'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            Active ({stats.active})
          </button>
          <button
            onClick={() => setFilter('other')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
              filter === 'other'
                ? 'bg-red-600 text-white'
                : 'text-red-700 hover:bg-red-50'
            }`}
          >
            Expired / Rejected ({stats.expired + stats.rejected})
          </button>
        </div>

        {/* Search Input */}
        <div className="w-full sm:w-72">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search PC, MAC, Key, Customer..."
            className="w-full px-3 py-1.5 text-xs rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Licenses Directory Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#07502f] text-white uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-4 font-semibold">Device & Customer</th>
                <th className="py-3 px-4 font-semibold">MAC Address</th>
                <th className="py-3 px-4 font-semibold">Activation Key</th>
                <th className="py-3 px-4 font-semibold">OS Specs</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Expiration</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-gray-500">
                    Loading devices...
                  </td>
                </tr>
              ) : filteredLicenses.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-gray-400">
                    No devices match this filter.
                  </td>
                </tr>
              ) : (
                filteredLicenses.map((item) => {
                  const isPending = item.status === 'pending'
                  const isActive = item.status === 'active'
                  const isRejected = item.status === 'rejected'
                  const isExpired = item.status === 'expired'

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-gray-50/80 transition-colors ${
                        isPending ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      {/* Device & Customer */}
                      <td className="py-3 px-4 align-middle">
                        <div className="font-bold text-gray-900 text-sm">
                          {item.customer_name || 'No customer name'}
                        </div>
                        <div className="text-gray-500 text-[11px] flex items-center gap-1">
                          <span>💻</span>
                          <span>{item.hostname || 'Unknown Host'}</span>
                        </div>
                      </td>

                      {/* MAC Address */}
                      <td className="py-3 px-4 align-middle">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(item.mac_address, 'mac')}
                          className="font-mono text-gray-800 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
                          title="Click to copy MAC address"
                        >
                          <span>{item.mac_address}</span>
                          <span>{copiedKey === `mac_${item.mac_address}` ? '✓' : '📋'}</span>
                        </button>
                      </td>

                      {/* Activation Key */}
                      <td className="py-3 px-4 align-middle">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(item.activation_key, 'key')}
                          className="font-mono text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 transition-colors"
                          title="Click to copy Activation Key"
                        >
                          <span>{item.activation_key}</span>
                          <span>{copiedKey === `key_${item.activation_key}` ? '✓' : '📋'}</span>
                        </button>
                      </td>

                      {/* OS Specs */}
                      <td className="py-3 px-4 align-middle text-gray-600 max-w-[160px] truncate" title={item.os_info}>
                        {item.os_info || '—'}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 align-middle">
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Pending
                          </span>
                        )}
                        {isActive && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            Active
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-800">
                            Rejected
                          </span>
                        )}
                        {isExpired && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-gray-200 text-gray-700">
                            Expired
                          </span>
                        )}
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
                          {isActive ? 'Edit Expiry' : 'Activate'}
                        </button>

                        {!isRejected && (
                          <button
                            type="button"
                            onClick={() => handleReject(item)}
                            disabled={actionLoading === item.id}
                            className="px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-bold text-[11px] transition-all"
                          >
                            Reject
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          disabled={actionLoading === item.id}
                          className="px-2 py-1 rounded-lg text-gray-400 hover:text-red-600 font-bold text-[11px] transition-all"
                          title="Delete entry"
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

      {/* Activation / Expiry Modal */}
      {isModalOpen && selectedLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-5 border border-gray-100">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {selectedLicense.status === 'active'
                    ? 'Update License / Expiry'
                    : 'Activate Computer'}
                </h3>
                <p className="text-xs text-gray-500">
                  {selectedLicense.hostname} ({selectedLicense.mac_address})
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Customer / Business Name (Identification)
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Al-Madina Rice Traders (Lahore)"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  License Duration / Expiration
                </label>
                <div className="grid grid-cols-3 gap-2 mb-2">
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
                      className={`py-2 px-2 rounded-xl font-bold border transition-all ${
                        expiryOption === opt.val
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-sm'
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
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full mt-2 px-3 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                )}
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Admin Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Cash received for 1 year license."
                  rows="2"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-emerald-900 text-[11px] leading-relaxed">
                ℹ️ <strong>Note:</strong> Once activated, the software will unlock immediately on the customer&apos;s machine and operate offline.
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-gray-700 hover:bg-gray-100 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveActivation}
                disabled={actionLoading === selectedLicense.id}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow transition-all"
              >
                {actionLoading === selectedLicense.id ? 'Saving...' : 'Confirm Activation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

