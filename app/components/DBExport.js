'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'

export default function DBExport() {
  const [tables, setTables] = useState([])
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingSqlite, setLoadingSqlite] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    axios
      .get('/api/db/tables')
      .then((res) => {
        const tableNames = res.data.tables || []
        setTables(tableNames)
        setSelected(tableNames[0] || '')
      })
      .catch((err) => {
        console.error('Failed to load tables:', err)
        setError('Failed to load table list.')
      })
  }, [])

  const triggerDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const exportCSV = async (tableName) => {
    if (!tableName) return
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/db/export', {
        method: 'POST',
        body: JSON.stringify({ table: tableName }),
        headers: { 'Content-Type': 'application/json' },
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Export failed')
      }

      const blob = await res.blob()
      if (blob.size === 0) {
        throw new Error('Downloaded file is empty')
      }

      triggerDownload(blob, `${tableName}.csv`)
      setSuccess(`Table "${tableName}" exported successfully.`)
    } catch (err) {
      console.error('Download failed', err)
      setError(err.message || 'Download failed')
    } finally {
      setLoading(false)
    }
  }

  const exportFullDatabase = async (format = 'csv') => {
    if (format === 'sqlite') {
      setLoadingSqlite(true)
    } else {
      setLoading(true)
    }
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`/api/db/export-all?format=${format}`)

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.message || json.error || 'Full export failed')
      }

      const blob = await res.blob()
      if (blob.size === 0) {
        throw new Error('Downloaded database file is empty')
      }

      const today = new Date().toISOString().slice(0, 10)
      const filename =
        format === 'sqlite' ? `ims-database-backup-${today}.sqlite` : `full-database-${today}.csv`

      triggerDownload(blob, filename)
      setSuccess(
        format === 'sqlite'
          ? 'Complete SQLite database file downloaded successfully.'
          : 'Complete database CSV backup downloaded successfully.'
      )
    } catch (err) {
      console.error('Full export failed', err)
      setError(err.message || 'Full export failed')
    } finally {
      setLoading(false)
      setLoadingSqlite(false)
    }
  }

  return (
    <div className="w-full max-w-xl space-y-5 bg-white transition-all duration-300">
      <p className="text-sm text-gray-500">
        Export your complete database.
      </p>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          ❌ {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-700">
          ✅ {success}
        </div>
      )}

      {/* Full Database Export Section */}
      <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <h3 className="font-semibold text-gray-800">Complete Database Backup</h3>
        <p className="text-xs text-gray-500">
          Backs up all tables including sales, purchases, inventory, accounts, ledger, and settings.
        </p>

        <div className="grid">
          <button
            type="button"
            onClick={() => exportFullDatabase('csv')}
            disabled={loading || loadingSqlite}
            className={`flex items-center justify-center gap-2 rounded-lg py-2.5 px-4 font-semibold text-white shadow-sm transition ${
              loading
                ? 'cursor-not-allowed bg-gray-400'
                : 'bg-green-600 hover:bg-green-700 active:scale-[0.98]'
            }`}
          >
            {loading ? 'Exporting...' : '📦 Download CSV Dump'}
          </button>

          {/* <button
            type="button"
            onClick={() => exportFullDatabase('sqlite')}
            disabled={loading || loadingSqlite}
            className={`flex items-center justify-center gap-2 rounded-lg py-2.5 px-4 font-semibold text-white shadow-sm transition ${
              loadingSqlite
                ? 'cursor-not-allowed bg-gray-400'
                : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98]'
            }`}
          >
            {loadingSqlite ? 'Exporting...' : '💾 Download SQLite (.sqlite)'}
          </button> */}
        </div>
      </div>

      {/* Single Table Export Section */}
      {/* <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="font-semibold text-gray-800">Export Individual Table</h3>
        <div className="space-y-2">
          <label htmlFor="tableSelect" className="block text-xs font-semibold text-gray-600">
            Select Table ({tables.length} tables available)
          </label>
          <select
            id="tableSelect"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={loading || !tables.length}
            className="w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            {tables.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => exportCSV(selected)}
          disabled={loading || !selected}
          className={`w-full rounded-lg py-2.5 font-medium text-white shadow-sm transition ${
            loading || !selected
              ? 'cursor-not-allowed bg-gray-300 text-gray-500'
              : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'
          }`}
        >
          ⬇️ Download {selected ? `"${selected}.csv"` : 'Table CSV'}
        </button>
      </div> */}
    </div>
  )
}
