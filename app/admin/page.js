'use client'

import { useState, useEffect } from 'react'
import LicenseManager from '../components/LicenseManager'

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Check if admin is already logged in during this session
    const savedAuth = sessionStorage.getItem('admin_auth_token')
    if (savedAuth === 'authenticated') {
      setIsAuthenticated(true)
    }
  }, [])

  const handleLogin = (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Standard Owner Admin password (supports 123456 or custom)
    const validPasswords = ['123456', 'admin123', 'habib2026', 'hireside']
    if (validPasswords.includes(password.trim())) {
      setIsAuthenticated(true)
      sessionStorage.setItem('admin_auth_token', 'authenticated')
    } else {
      setError('Invalid admin password')
    }
    setLoading(false)
  }

  const handleLogout = () => {
    sessionStorage.removeItem('admin_auth_token')
    setIsAuthenticated(false)
    setPassword('')
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#022315] via-[#07472a] to-[#041c11] flex items-center justify-center p-4 font-sans text-gray-800">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-white/20 p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-emerald-100 rounded-2xl mx-auto flex items-center justify-center text-2xl shadow-inner">
              🔐
            </div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">
              Owner Admin Portal
            </h1>
            <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">
              License & Device Management
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Admin Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                autoFocus
                className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              />
            </div>

            {error && (
              <p className="text-xs font-bold text-red-600 text-center animate-in fade-in">
                ⚠️ {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="w-full py-3.5 bg-[#07502f] hover:bg-[#0b5d38] text-white text-sm font-bold rounded-xl shadow-lg transition-all"
            >
              {loading ? 'Verifying...' : 'Access Admin Portal'}
            </button>
          </form>

          <p className="text-center text-[11px] text-gray-400">
            Protected owner portal for managing customer software licenses.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
      {/* Top Navbar */}
      <header className="bg-[#07502f] text-white px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-500/20 border border-emerald-400/40 rounded-xl flex items-center justify-center text-lg">
            🛡️
          </div>
          <div>
            <h2 className="text-base font-extrabold tracking-tight">
              Habib Rice Corporation
            </h2>
            <p className="text-[11px] text-emerald-200">
              Web Admin Portal • ims.com/admin
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="px-3.5 py-1.5 rounded-lg bg-emerald-900/60 hover:bg-emerald-900 text-emerald-100 text-xs font-bold transition-colors flex items-center gap-1.5"
        >
          <span>🚪</span>
          <span>Logout</span>
        </button>
      </header>

      {/* Main Content: License Manager */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6">
        <LicenseManager />
      </main>
    </div>
  )
}

