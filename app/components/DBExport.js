'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'

export default function DBExport() {
    const [tables, setTables] = useState([])
    const [selected, setSelected] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        axios.get('/api/db/tables')
            .then(res => {
                const tableNames = res.data.tables || []
                setTables(tableNames)
                setSelected(tableNames[0] || '')
            })
            .catch(err => {
                console.error('Failed to load tables:', err)
                setError('Failed to load table list.')
            })
    }, [])

    const exportCSV = async (tableName) => {
        if (!tableName) return
        setLoading(true)
        try {
            const res = await fetch('/api/db/export', {
                method: 'POST',
                body: JSON.stringify({ table: tableName }),
                headers: { 'Content-Type': 'application/json' },
            })
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${tableName}.csv`
            a.click()
            URL.revokeObjectURL(url)
        } catch (err) {
            console.error('Download failed', err)
        }
        setLoading(false)
    }

    const exportFullDatabase = async () => {
        const res = await fetch('/api/db/export-all') // assuming route is export-all
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `full-database.csv`
        a.click()
        URL.revokeObjectURL(url)
    }




    return (
        <div className="bg-white max-w-xl w-full transition-all duration-300">

            {error && <p className="text-red-500 text-sm">{error}</p>}

            {tables.length > 0 ? (
                <>
                    {/* Table Select */}
                    <div>
                        <label htmlFor="tableSelect" className="block text-sm font-medium text-gray-600 mb-1">
                            Select Table
                        </label>
                        <select
                            id="tableSelect"
                            value={selected}
                            onChange={e => setSelected(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-400 focus:outline-none"
                        >
                            {tables.map((t, i) => (
                                <option key={i} value={t}>{t}</option>
                            ))}
                        </select>
                    </div>

                    {/* Export Single */}
                    <div className="pt-2">
                        <button
                            onClick={() => exportCSV(selected)}
                            disabled={loading || !selected}
                            className={`w-full py-2 cursor-pointer rounded-md font-medium transition ${loading
                                    ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}
                        >
                            ⬇️ Download {selected}.csv
                        </button>
                    </div>

                    {/* Export All */}
                    <div className="border-t pt-4">
                        <button
                            onClick={exportFullDatabase}
                            disabled={loading}
                            className={`w-full py-2 cursor-pointer rounded-md font-medium transition ${loading
                                    ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                    : 'bg-green-600 hover:bg-green-700 text-white'
                                }`}
                        >
                            📦 Download Full Database (.csv)
                        </button>
                    </div>
                </>
            ) : (
                <p className="text-gray-500 text-sm">No tables available.</p>
            )}
        </div>

    )
}
