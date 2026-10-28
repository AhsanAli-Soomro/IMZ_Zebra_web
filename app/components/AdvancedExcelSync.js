'use client'

import { useState } from 'react'
import axios from 'axios'

export default function AdvancedExcelSync() {
  const [downloading, setDownloading] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [previewRows, setPreviewRows] = useState([])
  const [importStatus, setImportStatus] = useState(null)

  const downloadSpreadsheet = async (type, filename) => {
    setDownloading(type)
    try {
      const res = await axios.get(`/api/excel-sync?type=${type}`)
      if (res.data?.ok && res.data?.data) {
        const rows = res.data.data
        if (rows.length === 0) {
          alert('No records available to export.')
          return
        }

        // Generate clean CSV format compatible with Excel (.csv)
        const headers = Object.keys(rows[0])
        const csvContent = [
          headers.join(','),
          ...rows.map((row) =>
            headers
              .map((h) => {
                const val = row[h] === null || row[h] === undefined ? '' : String(row[h])
                return `"${val.replace(/"/g, '""')}"`
              })
              .join(',')
          ),
        ].join('\r\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      alert('Failed to export data: ' + err.message)
    } finally {
      setDownloading(null)
    }
  }

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target?.result
        if (typeof text !== 'string') return

        const lines = text.split(/\r\n|\n/).filter((l) => l.trim() !== '')
        if (lines.length < 2) {
          alert('The uploaded file appears to be empty.')
          return
        }

        const headers = lines[0].split(',').map((h) => h.replace(/(^"|"$)/g, '').trim())
        const parsed = []

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map((v) => v.replace(/(^"|"$)/g, '').trim())
          if (values.length >= headers.length) {
            const obj = {}
            headers.forEach((h, idx) => {
              obj[h] = values[idx]
            })
            parsed.push(obj)
          }
        }

        setPreviewRows(parsed)
        setImportStatus(null)
      } catch (err) {
        alert('Could not parse file: ' + err.message)
      }
    }
    reader.readAsText(file)
  }

  const handleConfirmImport = async () => {
    if (previewRows.length === 0) return
    setUploading(true)
    try {
      const res = await axios.post('/api/excel-sync', { items: previewRows })
      if (res.data?.ok) {
        setImportStatus({
          success: true,
          message: res.data.message,
        })
        setPreviewRows([])
      }
    } catch (err) {
      setImportStatus({
        success: false,
        message: err?.response?.data?.error || 'Import failed',
      })
    } finally {
      setUploading(false)
    }
  }

  const downloadSampleTemplate = () => {
    const sample = `Item_Name,Quantity,Cost_Price,Sale_Price,Unit
Super Kernel Basmati (50kg),100,6800,7500,Bags
Sela Rice 1121 Grade A,50,7200,8100,Bags
Kainat Steamed Rice,80,5900,6600,Bags`
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'Zebra_IMS_Sample_Stock_Template.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-10">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-950 via-gray-900 to-teal-950 text-white p-5 rounded-2xl shadow-xl flex items-center justify-between border border-emerald-800/30">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">Spreadsheet & Excel Sync</h1>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              Live Spreadsheet Module
            </span>
          </div>
          <p className="text-xs text-emerald-200/80 mt-0.5">
            1-Click Excel export for inventory & ledgers, plus bulk stock spreadsheet uploading.
          </p>
        </div>
        <div className="text-3xl">📊</div>
      </div>

      {/* Export Section */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div>
          <h2 className="text-sm font-bold text-gray-900">1. Instant Excel Export</h2>
          <p className="text-xs text-gray-500">Download formatted sheets directly compatible with Microsoft Excel & Google Sheets.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 flex flex-col justify-between space-y-3">
            <div>
              <span className="text-lg block">📦</span>
              <span className="font-bold text-xs text-emerald-950 block">Stock & Inventory Sheet</span>
              <span className="text-[11px] text-emerald-800 block">Full list of products, quantities, purchase rates, and total stock valuation.</span>
            </div>
            <button
              type="button"
              onClick={() => downloadSpreadsheet('inventory', 'Zebra_Stock_Inventory')}
              disabled={downloading === 'inventory'}
              className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-1.5"
            >
              <span>{downloading === 'inventory' ? 'Exporting...' : '⬇️ Export Stock Excel'}</span>
            </button>
          </div>

          <div className="p-4 rounded-xl border border-sky-200 bg-sky-50/50 flex flex-col justify-between space-y-3">
            <div>
              <span className="text-lg block">👥</span>
              <span className="font-bold text-xs text-sky-950 block">Customer Balances & Khata</span>
              <span className="text-[11px] text-sky-800 block">All customer names, contact numbers, cities, and net payable balances.</span>
            </div>
            <button
              type="button"
              onClick={() => downloadSpreadsheet('customers', 'Zebra_Customer_Balances')}
              disabled={downloading === 'customers'}
              className="w-full py-2 bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-1.5"
            >
              <span>{downloading === 'customers' ? 'Exporting...' : '⬇️ Export Customers Excel'}</span>
            </button>
          </div>

          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 flex flex-col justify-between space-y-3">
            <div>
              <span className="text-lg block">🚛</span>
              <span className="font-bold text-xs text-amber-950 block">Supplier Payables Sheet</span>
              <span className="text-[11px] text-amber-800 block">Suppliers ledger summary, contact details, and outstanding balances.</span>
            </div>
            <button
              type="button"
              onClick={() => downloadSpreadsheet('suppliers', 'Zebra_Supplier_Balances')}
              disabled={downloading === 'suppliers'}
              className="w-full py-2 bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-1.5"
            >
              <span>{downloading === 'suppliers' ? 'Exporting...' : '⬇️ Export Suppliers Excel'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Upload Section */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-gray-900">2. Bulk Stock Excel Upload</h2>
            <p className="text-xs text-gray-500">Quickly add dozens of items or update existing stock quantities using a spreadsheet.</p>
          </div>
          <button
            type="button"
            onClick={downloadSampleTemplate}
            className="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-xs font-bold text-gray-700 transition-colors shrink-0"
          >
            📋 Download Sample Excel Template
          </button>
        </div>

        <div className="p-6 border-2 border-dashed border-gray-300 hover:border-emerald-500 rounded-2xl text-center space-y-2 bg-gray-50/50 transition-colors">
          <span className="text-3xl block">📥</span>
          <label className="cursor-pointer inline-block px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-sm transition-colors">
            <span>Select Excel / CSV File</span>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
          <p className="text-[11px] text-gray-400">Supported formats: .CSV / Excel Comma Separated Sheet</p>
        </div>

        {importStatus && (
          <div
            className={`p-3 rounded-xl border text-xs font-semibold ${
              importStatus.success
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}
          >
            {importStatus.message}
          </div>
        )}

        {/* Preview Table */}
        {previewRows.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-800">
                Preview Rows ({previewRows.length} items detected):
              </span>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={uploading}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-colors"
              >
                {uploading ? 'Importing...' : '✓ Confirm & Upload into Database'}
              </button>
            </div>

            <div className="overflow-x-auto max-h-60 border rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100 text-gray-700 font-bold sticky top-0">
                  <tr>
                    {Object.keys(previewRows[0]).map((h) => (
                      <th key={h} className="py-2 px-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {previewRows.slice(0, 50).map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      {Object.values(row).map((v, i) => (
                        <td key={i} className="py-1.5 px-3">{String(v)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
