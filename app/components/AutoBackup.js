'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'

export default function AutoBackup() {
  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [autoDaily, setAutoDaily] = useState(true)

  const fetchBackups = async () => {
    setLoading(true)
    try {
      const res = await axios.get('/api/auto-backup')
      if (res.data?.ok) {
        setBackups(res.data.data || [])
      }
    } catch (err) {
      console.warn('Fetch backups error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBackups()
  }, [])

  const handleCreateBackup = async () => {
    setCreating(true)
    try {
      const res = await axios.post('/api/auto-backup')
      if (res.data?.ok) {
        alert(res.data.message || 'Backup snapshot created successfully!')
        fetchBackups()
      }
    } catch (err) {
      alert('Failed to create backup: ' + err.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-10">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-950 via-gray-900 to-cyan-950 text-white p-5 rounded-2xl shadow-xl flex items-center justify-between border border-emerald-800/30">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">Automated Cloud & Local Backup</h1>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              Data Security Module
            </span>
          </div>
          <p className="text-xs text-emerald-200/80 mt-0.5">
            Automatic daily database snapshots, instant local rollback, and Google Drive cloud protection.
          </p>
        </div>
        <div className="text-3xl">🔄</div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-xl">
            💾
          </div>
          <div>
            <span className="text-[11px] text-gray-500 font-bold block">Total Saved Snapshots</span>
            <span className="text-lg font-bold text-gray-900">{backups.length} Files</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center text-xl">
            ⏱️
          </div>
          <div>
            <span className="text-[11px] text-gray-500 font-bold block">Last Snapshot Taken</span>
            <span className="text-xs font-bold text-gray-900">
              {backups[0] ? new Date(backups[0].created_at).toLocaleString() : 'No backup yet'}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center text-xl">
            ☁️
          </div>
          <div>
            <span className="text-[11px] text-gray-500 font-bold block">Cloud Drive Protection</span>
            <span className="text-xs font-bold text-emerald-700">Ready (Local Vault Active)</span>
          </div>
        </div>
      </div>

      {/* Instant Action Bar */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-gray-900">Instant Database Snapshot</h2>
          <p className="text-xs text-gray-500">Takes a safe, uncorrupted snapshot of your current invoices, ledgers, and inventory.</p>
        </div>

        <button
          type="button"
          onClick={handleCreateBackup}
          disabled={creating}
          className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition-colors flex items-center gap-2 shrink-0"
        >
          <span>{creating ? 'Saving...' : '💾 Create Instant Backup Now'}</span>
        </button>
      </div>

      {/* Saved Backups Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-gray-50 border-b flex items-center justify-between">
          <span className="text-xs font-bold text-gray-800">Available Backup Snapshots</span>
          <span className="text-[11px] text-gray-500">Stored in local database/backups vault</span>
        </div>

        {loading ? (
          <div className="py-10 text-center text-xs text-gray-400">Loading backups...</div>
        ) : backups.length === 0 ? (
          <div className="py-10 text-center text-xs text-gray-400">
            No backup snapshots created yet. Click "Create Instant Backup Now" above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Backup File Name</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Created Date & Time</th>
                  <th className="py-3 px-4">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {backups.map((b, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="py-3 px-4 font-mono font-bold text-gray-900 flex items-center gap-2">
                      <span>🗄️</span>
                      <span>{b.filename}</span>
                    </td>
                    <td className="py-3 px-4 font-bold text-emerald-800">{b.size_kb} KB</td>
                    <td className="py-3 px-4 text-gray-500">
                      {new Date(b.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 border">
                        SQLite Snapshot
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cloud Backup Setup Card */}
      <div className="p-5 rounded-2xl border border-sky-200 bg-sky-50/60 text-xs space-y-2 text-sky-950">
        <div className="flex items-center gap-2 font-bold text-sm">
          <span>☁️</span>
          <span>Automatic Google Drive Sync Setup</span>
        </div>
        <p className="leading-relaxed text-[11px] text-sky-900">
          Agar aap chahte hain ke rozana raat dukan band hone par yeh backup snapshots automatically aapke Google Drive par upload ho jayein, to aap apne computer me Google Drive Desktop app install karke `database/backups` folder ko sync folder bana sakte hain. Yeh 100% free hai aur aapke phone par hamesha latest hisab kitab ka backup safe rahega.
        </p>
      </div>
    </div>
  )
}
