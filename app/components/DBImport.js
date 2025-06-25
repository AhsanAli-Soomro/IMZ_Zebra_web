'use client'

import { useEffect, useState, useRef } from 'react'
import axios from 'axios'

export default function DBImport() {
  const [tables, setTables] = useState([])
  const [selected, setSelected] = useState('')
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null)
  const fileInputRef = useRef(null)

useEffect(() => {
  axios.get('/api/db/tables')
    .then(res => {
      const rawTables = res.data.tables || []
      const tableNames = rawTables.map(t => {
        const firstVal = Object.values(t)[0]
        return typeof firstVal === 'string' ? firstVal : ''
      }).filter(Boolean)
      setTables(tableNames)
      if (tableNames.length > 0) setSelected(tableNames[0])
    })
    .catch(err => {
      console.error('Failed to fetch tables:', err)
    })
}, [])


  const clearFileInput = () => {
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleImport = async () => {
    if (!file || !selected) {
      alert('Please select a table and a valid CSV file.')
      return
    }

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

      if (res.ok) {
        setStatus({ success: true, message: `✅ Imported to "${selected}" successfully.` })
        clearFileInput()
      } else {
        const error = await res.text()
        setStatus({ success: false, message: `❌ Import failed: ${error}` })
      }
    } catch (err) {
      setStatus({ success: false, message: `❌ Import error: ${err.message}` })
    }

    setLoading(false)
  }

  const handleFullImport = async () => {
    if (!file) {
      alert('Please select a full CSV dump file.')
      return
    }

    setLoading(true)
    setStatus(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/db/import-all', {
        method: 'POST',
        body: formData,
      })

      const result = await res.json()
      if (res.ok) {
        setStatus({ success: true, message: '✅ Full DB imported successfully.' })
        clearFileInput()
      } else {
        setStatus({ success: false, message: result.message || '❌ Import failed.' })
      }
    } catch (err) {
      setStatus({ success: false, message: `❌ Import error: ${err.message}` })
    }

    setLoading(false)
  }

  return (
    <div className="bg-white max-w-xl w-full transition-all duration-300 p-6 rounded-lg shadow-md space-y-4">
      <h2 className="text-xl font-semibold text-green-700">📥 Import CSV Data</h2>
      <p className="text-sm text-gray-500">
        Upload a CSV file to import data into a specific table or your full database.
      </p>

      {/* Table Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Target Table</label>
        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-400"
        >
          {tables.length === 0 ? (
            <option>No tables available</option>
          ) : (
            tables.map((t, i) => <option key={i} value={t}>{t}</option>)
          )}
        </select>
      </div>

      {/* File Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">CSV File</label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={e => setFile(e.target.files[0])}
          className="w-full p-2 border border-gray-300 rounded cursor-pointer"
        />
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <button
          onClick={handleImport}
          disabled={!file || !selected || loading}
          className={`w-full py-2 rounded-md font-medium transition ${
            loading ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 text-white'
          }`}
        >
          {loading ? 'Importing...' : `📤 Import to "${selected}"`}
        </button>

        <button
          onClick={handleFullImport}
          disabled={!file || loading}
          className={`w-full py-2 rounded-md font-medium transition ${
            loading ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {loading ? 'Importing Full DB...' : '📦 Import Full Database'}
        </button>
      </div>

      {/* Status */}
      {status && (
        <div className={`text-sm ${status.success ? 'text-green-600' : 'text-red-600'} mt-2`}>
          {status.message}
        </div>
      )}
    </div>
  )
}
