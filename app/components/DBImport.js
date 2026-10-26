'use client'

import { useEffect, useState, useRef } from 'react'
import axios from 'axios'

export default function DBImport() {
  const [tables, setTables] = useState([])
  const [selected, setSelected] = useState('')
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingFull, setLoadingFull] = useState(false)
  const [status, setStatus] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    axios
      .get('/api/db/tables')
      .then((res) => {
        const tableNames = res.data.tables || []
        setTables(tableNames)
        if (tableNames.length > 0) setSelected(tableNames[0])
      })
      .catch((err) => {
        console.error('Failed to fetch tables:', err)
      })
  }, [])

  const clearFileInput = () => {
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleImport = async () => {
    if (!file || !selected) {
      alert('Please select a table and a CSV file.')
      return
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Single table import requires a .csv file.')
      return
    }

    const confirmImport = window.confirm(
      `Are you sure you want to import data into table "${selected}"? Records with matching IDs will be updated.`
    )
    if (!confirmImport) return

    setLoading(true)
    setStatus(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('table', selected)

    try {
      const res = await fetch('/api/db/import', {
        method: 'POST',
        body: formData,
      })

      const json = await res.json().catch(() => ({}))
      if (res.ok && json.success) {
        setStatus({
          success: true,
          message: json.message || `Successfully imported records into "${selected}".`,
        })
        clearFileInput()
      } else {
        setStatus({
          success: false,
          message: json.message || json.error || 'Import failed.',
        })
      }
    } catch (err) {
      setStatus({ success: false, message: `Import error: ${err.message}` })
    } finally {
      setLoading(false)
    }
  }

  const handleFullImport = async () => {
    if (!file) {
      alert('Please select a backup file (.csv or .sqlite).')
      return
    }

    const isSqlite =
      file.name.toLowerCase().endsWith('.sqlite') || file.name.toLowerCase().endsWith('.db')
    const isCsv = file.name.toLowerCase().endsWith('.csv')

    if (!isSqlite && !isCsv) {
      alert('Please select a valid backup file (.csv, .sqlite, or .db).')
      return
    }

    const confirmRestore = window.confirm(
      '⚠️ WARNING: Full database restore will replace existing data in the restored tables with the backup data.\n\nAre you sure you want to proceed?'
    )
    if (!confirmRestore) return

    setLoadingFull(true)
    setStatus(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/db/import-all', {
        method: 'POST',
        body: formData,
      })

      const result = await res.json().catch(() => ({}))
      if (res.ok && result.success) {
        setStatus({
          success: true,
          message:
            result.message ||
            'Full database restored successfully! Please refresh the page if needed.',
        })
        clearFileInput()
      } else {
        setStatus({
          success: false,
          message: result.message || result.error || 'Full database import failed.',
        })
      }
    } catch (err) {
      setStatus({ success: false, message: `Import error: ${err.message}` })
    } finally {
      setLoadingFull(false)
    }
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  return (
    <div className="w-full max-w-xl space-y-5 rounded-xl bg-white shadow-none transition-all duration-300">
      <p className="text-sm text-gray-500">
        Restore your full database backup.
      </p>

      {/* File Upload Box */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <label className="mb-1 block text-xs font-semibold text-gray-700">
          Select Backup File (.csv, .sqlite, .db)
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.sqlite,.db"
            onChange={(e) => {
              setFile(e.target.files[0] || null)
              setStatus(null)
            }}
            disabled={loading || loadingFull}
            className="w-full cursor-pointer rounded-lg border border-gray-300 bg-white p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
          />
          {file && (
            <button
              type="button"
              onClick={clearFileInput}
              disabled={loading || loadingFull}
              className="whitespace-nowrap rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              Clear
            </button>
          )}
        </div>
        {file && (
          <p className="mt-2 text-xs font-medium text-indigo-700">
            Selected: <span className="font-semibold">{file.name}</span> ({formatFileSize(file.size)})
          </p>
        )}
      </div>

      {/* Status Alert */}
      {status && (
        <div
          className={`rounded-lg border p-3 text-sm font-medium ${
            status.success
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {status.success ? '✅ ' : '❌ '}
          {status.message}
        </div>
      )}

      {/* Actions */}
      <div className="space-y-4">
        {/* Full Database Restore */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
          <h3 className="font-semibold text-gray-900">Restore Complete Database</h3>
          <p className="mb-3 text-xs text-gray-500">
            Restores compelete database from a backup file.
          </p>
          <button
            type="button"
            onClick={handleFullImport}
            disabled={!file || loading || loadingFull}
            className={`w-full rounded-lg py-2.5 font-semibold text-white shadow-sm transition ${
              !file || loading || loadingFull
                ? 'cursor-not-allowed bg-gray-300 text-gray-500'
                : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'
            }`}
          >
            {loadingFull ? 'Restoring Complete Database...' : '📥 Import Full Database Backup'}
          </button>
        </div>

        {/* Individual Table Import */}
        {/* <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="font-semibold text-gray-900">Import Into Single Table</h3>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">
              Target Table
            </label>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              disabled={loading || loadingFull || !tables.length}
              className="w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
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
            onClick={handleImport}
            disabled={!file || !selected || loading || loadingFull}
            className={`w-full rounded-lg py-2.5 font-medium text-white shadow-sm transition ${
              !file || !selected || loading || loadingFull
                ? 'cursor-not-allowed bg-gray-300 text-gray-500'
                : 'bg-purple-600 hover:bg-purple-700 active:scale-[0.98]'
            }`}
          >
            {loading ? 'Importing Table...' : `📤 Import to "${selected}"`}
          </button>
        </div> */}
      </div>
    </div>
  )
}
