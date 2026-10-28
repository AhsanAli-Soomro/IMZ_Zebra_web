'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'

export default function GeminiAdminSettings() {
  const [apiKey, setApiKey] = useState('')
  const [keyName, setKeyName] = useState('Gemini API Key For IMS')
  const [projectName, setProjectName] = useState('projects/90016021959')
  const [projectNumber, setProjectNumber] = useState('90016021959')
  const [enabled, setEnabled] = useState(true)

  const [showKey, setShowKey] = useState(false)
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' })
  const [copied, setCopied] = useState(false)

  // Load existing settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true)
        const adminPwd = sessionStorage.getItem('admin_auth_password') || ''
        const res = await axios.get('/api/admin/gemini-settings', {
          headers: { 'x-admin-password': adminPwd },
        })
        if (res.data?.ok && res.data.data) {
          const d = res.data.data
          if (d.apiKey) setApiKey(d.apiKey)
          if (d.keyName) setKeyName(d.keyName)
          if (d.projectName) setProjectName(d.projectName)
          if (d.projectNumber) setProjectNumber(d.projectNumber)
          if (d.enabled !== undefined) setEnabled(d.enabled)
        }
      } catch (err) {
        console.warn('Could not load Gemini settings:', err)
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [])

  const handleCopy = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(apiKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      setStatusMessage({ type: 'error', text: 'Pehle API Key darj karein.' })
      return
    }

    setTesting(true)
    setTestResult(null)
    setStatusMessage({ type: '', text: '' })

    try {
      const adminPwd = sessionStorage.getItem('admin_auth_password') || ''
      const res = await axios.post(
        '/api/admin/gemini-settings',
        { action: 'test', apiKey: apiKey.trim() },
        { headers: { 'x-admin-password': adminPwd } }
      )

      if (res.data?.ok) {
        setTestResult({
          success: true,
          message: res.data.message || 'Google Gemini API is live and responding!',
          reply: res.data.reply,
        })
      } else {
        setTestResult({
          success: false,
          message: res.data.error || 'Google API test failed.',
        })
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: err.response?.data?.error || err.message || 'Connection test error.',
      })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setLoading(true)
    setStatusMessage({ type: '', text: '' })

    try {
      const adminPwd = sessionStorage.getItem('admin_auth_password') || ''
      const res = await axios.post(
        '/api/admin/gemini-settings',
        {
          apiKey: apiKey.trim(),
          keyName: keyName.trim(),
          projectName: projectName.trim(),
          projectNumber: projectNumber.trim(),
          enabled,
        },
        { headers: { 'x-admin-password': adminPwd } }
      )

      if (res.data?.ok) {
        setStatusMessage({
          type: 'success',
          text: 'Google Gemini API Key aur settings database me kamyabi se save ho chuki hain!',
        })
      } else {
        setStatusMessage({
          type: 'error',
          text: res.data?.error || 'Save karte waqt masla aya.',
        })
      }
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err.response?.data?.error || err.message || 'Save failed.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 animate-in fade-in">
      {/* Top Banner Card */}
      <div className="bg-gradient-to-r from-emerald-950 via-gray-900 to-indigo-950 text-white p-6 rounded-3xl shadow-xl border border-emerald-800/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-3xl shadow-inner">
            🤖
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight">Google Gemini AI Configuration</h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                Master Control
              </span>
            </div>
            <p className="text-xs text-emerald-200/80 mt-0.5">
              Admin Portal se centralized Google Gemini API keys manage karein. Client app automatically yahi key istemal karegi.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold border ${
              enabled
                ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/50'
                : 'bg-rose-950/70 text-rose-300 border-rose-500/50'
            }`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                enabled ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span>{enabled ? 'AI Engine Active' : 'AI Engine Disabled'}</span>
          </div>
        </div>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Google Gemini API Credentials</h2>
            <p className="text-xs text-gray-500">
              Yeh credentials SQLite database me secure rehte hain aur client users se mukammal chhupay hue hain.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-700 cursor-pointer flex items-center gap-2">
              <span>Enable Gemini Online Engine:</span>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* API Key Input Field */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-700">
              Gemini API Key <span className="text-rose-500">*</span>
            </label>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="text-gray-500 hover:text-gray-800 font-semibold"
              >
                {showKey ? '👁️ Hide' : '👁️ Show'}
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-1"
              >
                <span>{copied ? '✓ Copied' : '📋 Copy'}</span>
              </button>
            </div>
          </div>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter or paste Google Gemini API Key"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-300 font-mono text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50/50"
            />
          </div>
          <p className="text-[11px] text-gray-400">
            Google AI Studio ya Google Cloud Console se generate ki gayi Gemini Key yahan darj karein.
          </p>
        </div>

        {/* Grid for Name, Project Name, Project Number */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-700">
              Key Name / Label
            </label>
            <input
              type="text"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="e.g. Gemini API Key For IMS"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-700">
              Project Name
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. projects/90016021959"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-700">
              Project Number
            </label>
            <input
              type="text"
              value={projectNumber}
              onChange={(e) => setProjectNumber(e.target.value)}
              placeholder="e.g. 90016021959"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Status Message Notification */}
        {statusMessage.text && (
          <div
            className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            <span>{statusMessage.type === 'success' ? '✅' : '⚠️'}</span>
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Live Test Connection Result Card */}
        {testResult && (
          <div
            className={`p-4 rounded-2xl text-xs space-y-1.5 border animate-in fade-in ${
              testResult.success
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-2 font-bold">
              <span>{testResult.success ? '🟢 Google Gemini Connection Test Succeeded!' : '🔴 Connection Test Failed'}</span>
            </div>
            <div className="text-[11px] leading-relaxed opacity-90">
              {testResult.message}
            </div>
            {testResult.reply && (
              <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-200 font-mono text-[10px] text-gray-700">
                Google Model Response: &quot;{testResult.reply}&quot;
              </div>
            )}
          </div>
        )}

        {/* Actions Button Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing || !apiKey.trim()}
            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl transition-all flex items-center gap-2 border border-gray-300 disabled:opacity-50"
          >
            <span>🧪</span>
            <span>{testing ? 'Testing Connection...' : 'Test Gemini Connection'}</span>
          </button>

          <button
            type="submit"
            disabled={loading || !apiKey.trim()}
            className="px-6 py-2.5 bg-[#07502f] hover:bg-[#0b5d38] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <span>💾</span>
            <span>{loading ? 'Saving...' : 'Save Gemini Configuration'}</span>
          </button>
        </div>
      </form>

      {/* Architecture & Security Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs">
            <span className="text-base">🔒</span>
            <span>Client Privacy & Security</span>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            Client app me kisi bhi user ko yeh Gemini key nazar nahi aati aur na hi woh isay change kar sakte hain. Tamam AI queries server side se is key ke sath authentic ho kar process hoti hain.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs">
            <span className="text-base">⚡</span>
            <span>Automatic Dual-Engine Failover</span>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            Jab internet connect ho tou system Google Gemini cloud se live answers deta hai. Agar net band ho ya key expire ho, tou system foran 100% offline Local SQL Engine par shift ho jata hai.
          </p>
        </div>
      </div>
    </div>
  )
}

