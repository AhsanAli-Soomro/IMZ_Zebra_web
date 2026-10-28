'use client'

import { useState, useEffect } from 'react'
import LicenseManager from '../components/LicenseManager'
import GeminiAdminSettings from '../components/GeminiAdminSettings'

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeAdminTab, setActiveAdminTab] = useState('licenses') // 'licenses' | 'gemini'

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

    // Standard Owner Admin password (supports 123456, admin123, habib2026, hireside)
    const validPasswords = ['123456', 'admin123', 'habib2026', 'hireside']
    if (validPasswords.includes(password.trim())) {
      setIsAuthenticated(true)
      sessionStorage.setItem('admin_auth_token', 'authenticated')
      sessionStorage.setItem('admin_auth_password', password.trim())
    } else {
      setError('Invalid admin password. Please try again.')
    }
    setLoading(false)
  }

  const handleLogout = () => {
    sessionStorage.removeItem('admin_auth_token')
    sessionStorage.removeItem('admin_auth_password')
    setIsAuthenticated(false)
    setPassword('')
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#03150d] relative flex items-center justify-center p-4 font-sans text-gray-100 overflow-hidden selection:bg-emerald-500 selection:text-white">
        {/* Background Ambient Glows */}
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md relative z-10">
          <div className="bg-[#072417]/90 backdrop-blur-2xl rounded-3xl shadow-2xl overflow-hidden border border-emerald-500/30 p-8 space-y-6">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-[#07502f] rounded-2xl mx-auto flex items-center justify-center text-3xl shadow-lg shadow-emerald-950/50 border border-emerald-400/40">
                🛡️
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-emerald-950/90 text-emerald-300 border border-emerald-500/30 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Owner Command Center
                </div>
                <h1 className="text-2xl font-black text-white tracking-tight">
                  Zebra IMS Admin
                </h1>
                <p className="text-xs text-emerald-200/70 font-medium mt-1">
                  Cloud Licensing, Multi-PC Fleets & AI Control
                </p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-emerald-200/90 uppercase tracking-wider mb-1.5">
                  Master Admin Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter admin password"
                    autoFocus
                    className="w-full px-4 py-3 pr-11 rounded-xl bg-[#03150d]/80 border border-emerald-500/30 text-sm text-white placeholder-emerald-700/60 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-emerald-400/70 hover:text-emerald-300 text-xs font-bold"
                  >
                    {showPassword ? 'HIDE' : 'SHOW'}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !password.trim()}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-[#07502f] hover:from-emerald-500 hover:to-emerald-700 text-white text-xs font-extrabold uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-950/50 transition-all disabled:opacity-50"
              >
                {loading ? 'Authenticating...' : 'Access Command Center →'}
              </button>

              <div className="pt-2 text-center">
                <span className="text-[11px] text-emerald-400/60">
                  Quick Access: Click password to fill:
                </span>
                <div className="flex items-center justify-center gap-2 mt-1.5">
                  {['admin123', '123456', 'hireside'].map((pwd) => (
                    <button
                      key={pwd}
                      type="button"
                      onClick={() => setPassword(pwd)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/30 text-[10px] font-mono text-emerald-300 transition-colors"
                    >
                      {pwd}
                    </button>
                  ))}
                </div>
              </div>
            </form>

            <div className="pt-4 border-t border-emerald-900/60 text-center">
              <p className="text-[11px] text-emerald-400/50">
                Authoritative Master Portal • Neon Cloud PostgreSQL US-East
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8faf9] text-gray-900 font-sans antialiased selection:bg-emerald-500 selection:text-white">
      {/* Top Enterprise Navbar */}
      <header className="sticky top-0 z-40 bg-[#041c12] border-b border-emerald-900/60 text-white shadow-xl backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          {/* Brand Identity */}
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-[#07502f] border border-emerald-400/50 rounded-2xl flex items-center justify-center text-xl shadow-md shadow-emerald-950/40">
              🦓
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black tracking-tight text-white">
                  Zebra IMS
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                  Enterprise
                </span>
              </div>
              <p className="text-[11px] text-emerald-300/80 font-medium">
                Cloud License & Fleet Commander • ims.com/admin
              </p>
            </div>
          </div>

          {/* Navigation Tabs (Desktop) */}
          <div className="hidden md:flex items-center bg-[#02100a] p-1 rounded-2xl border border-emerald-800/50 shadow-inner">
            <button
              type="button"
              onClick={() => setActiveAdminTab('licenses')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeAdminTab === 'licenses'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-emerald-300/80 hover:text-white hover:bg-emerald-900/30'
              }`}
            >
              <span>🛡️</span>
              <span>Client Licenses & Multi-PC</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveAdminTab('gemini')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeAdminTab === 'gemini'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-emerald-300/80 hover:text-white hover:bg-emerald-900/30'
              }`}
            >
              <span>🤖</span>
              <span>Global Master AI Engine</span>
            </button>
          </div>

          {/* Right Controls: Cloud Status + User + Logout */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/30 text-[11px] font-semibold text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Neon Cloud PostgreSQL</span>
            </div>

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-600/30 text-xs font-bold text-white">
              <span>👑</span>
              <span>Owner Root</span>
            </div>

            <button
              onClick={handleLogout}
              className="px-3.5 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/40 text-rose-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
              title="Sign out of Owner Admin Portal"
            >
              <span>🚪</span>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Global Status Ticker */}
      <div className="bg-[#03150d] border-b border-emerald-950 text-emerald-300/80 px-4 sm:px-6 py-2 text-[11px] font-medium">
        <div className="max-w-7xl mx-auto flex items-center justify-between overflow-x-auto gap-4">
          <div className="flex items-center gap-6 whitespace-nowrap">
            <span className="flex items-center gap-1.5 text-emerald-300 font-bold">
              <span>🌐</span> System: <strong className="text-white">Active Online</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span>🛡️</span> Security: <strong className="text-emerald-200">Hardware Locked (MAC + UUID)</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span>🔐</span> Vault: <strong className="text-emerald-200">AES-256 Key Recovery</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span>🤖</span> AI Engine: <strong className="text-emerald-200">Google Gemini 3.5 Flash-Lite</strong>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-2 text-emerald-400/60">
            <span>Enterprise SLA 99.9%</span>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Tabs */}
      <div className="md:hidden flex items-center border-b border-gray-200 bg-white px-4 py-2 gap-2 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveAdminTab('licenses')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeAdminTab === 'licenses'
              ? 'bg-[#042014] text-white shadow'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <span>🛡️</span>
          <span>Licenses & Fleets</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveAdminTab('gemini')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeAdminTab === 'gemini'
              ? 'bg-[#042014] text-white shadow'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <span>🤖</span>
          <span>Global AI</span>
        </button>
      </div>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6">
        {activeAdminTab === 'licenses' ? (
          <LicenseManager />
        ) : (
          <GeminiAdminSettings />
        )}
      </main>
    </div>
  )
}
