'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ActivatePage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [status, setStatus] = useState('checking') // 'checking', 'pending', 'active', 'rejected', 'expired', 'offline'
  const [machineInfo, setMachineInfo] = useState({
    macAddress: '',
    hostname: '',
    activationKey: '',
    osInfo: '',
  })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [copiedType, setCopiedType] = useState('')

  // Manual Master key toggle
  const [showManualKey, setShowManualKey] = useState(false)
  const [manualKey, setManualKey] = useState('')
  const [manualLoading, setManualLoading] = useState(false)

  const checkLicense = async () => {
    setChecking(true)
    setError('')
    setMessage('')

    try {
      if (!window?.electronAPI?.licenseCheckOnline) {
        // Fallback for web dev or if electronAPI is not yet loaded
        if (window?.electronAPI?.licenseCheck) {
          const res = await window.electronAPI.licenseCheck()
          handleResult(res)
          return
        }
        setStatus('offline')
        setError('Desktop application environment not detected.')
        return
      }

      const res = await window.electronAPI.licenseCheckOnline()
      handleResult(res)
    } catch (err) {
      console.error('Activation check failed:', err)
      setStatus('offline')
      setError(err?.message || 'Failed to connect to license server')
    } finally {
      setChecking(false)
    }
  }

  const handleResult = (res) => {
    if (res?.macAddress || res?.activationKey) {
      setMachineInfo({
        macAddress: res.macAddress || '',
        hostname: res.hostname || '',
        activationKey: res.activationKey || '',
        osInfo: res.osInfo || '',
      })
    }

    if (res?.ok && (res?.status === 'active' || res?.reason === 'activated')) {
      setStatus('active')
      setMessage('Software activated successfully!')
      setTimeout(async () => {
        try {
          const profileRes = await fetch('/api/company-profile')
          const profile = await profileRes.json()
          if (!profile?.company_name || profile.company_name.trim() === '') {
            router.replace('/setup')
            return
          }
        } catch {}
        router.replace('/login')
      }, 1000)
    } else {
      const currentStatus = res?.status || (res?.reason === 'expired' ? 'expired' : 'pending')
      setStatus(currentStatus)
      if (res?.message) {
        setMessage(res.message)
      }
    }
  }

  useEffect(() => {
    checkLicense()
  }, [])

  const copyToClipboard = (text, type) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text)
      setCopiedType(type)
      setTimeout(() => setCopiedType(''), 2000)
    }
  }

  const handleManualActivate = async (e) => {
    e.preventDefault()
    if (!manualKey.trim()) return

    setManualLoading(true)
    setError('')
    setMessage('')

    try {
      if (!window?.electronAPI?.licenseActivate) {
        setError('License activation API not available')
        return
      }

      const res = await window.electronAPI.licenseActivate(manualKey.trim())
      if (res?.ok) {
        setMessage('Software activated with Master Key!')
        setStatus('active')
        setTimeout(async () => {
          try {
            const profileRes = await fetch('/api/company-profile')
            const profile = await profileRes.json()
            if (!profile?.company_name || profile.company_name.trim() === '') {
              router.replace('/setup')
              return
            }
          } catch {}
          router.replace('/login')
        }, 1200)
      } else {
        setError(res?.message || 'Invalid Master Key')
      }
    } catch (err) {
      setError(err?.message || 'Failed to activate')
    } finally {
      setManualLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#022315] via-[#07472a] to-[#041c11] text-gray-800 flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-xl bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl overflow-hidden border border-white/20">
        {/* Top Header Banner */}
        <div className="bg-[#07502f] p-6 text-white text-center relative">
          <div className="w-14 h-14 bg-emerald-500/20 border border-emerald-400/30 rounded-2xl mx-auto flex items-center justify-center text-2xl mb-3 shadow-inner">
            🛡️
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">
            Zebra IMS
          </h1>
          <p className="text-xs text-emerald-200 mt-1 uppercase tracking-widest font-bold">
            Enterprise IMS • System Activation
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Status Alert Banner */}
          {checking ? (
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-center gap-3">
              <span className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin shrink-0" />
              <div>
                <p className="text-sm font-bold text-emerald-900">
                  Checking License Status...
                </p>
                <p className="text-xs text-emerald-700">
                  Connecting to license server...
                </p>
              </div>
            </div>
          ) : status === 'active' ? (
            <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in">
              <span className="text-2xl">✅</span>
              <div>
                <p className="text-sm font-bold text-emerald-900">
                  License Activated!
                </p>
                <p className="text-xs text-emerald-700">
                  Your system has been approved. Redirecting to dashboard...
                </p>
              </div>
            </div>
          ) : status === 'rejected' ? (
            <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-center gap-3">
              <span className="text-2xl">🚫</span>
              <div>
                <p className="text-sm font-bold text-red-900">
                  Activation Request Rejected
                </p>
                <p className="text-xs text-red-700">
                  This computer&apos;s activation request was rejected by the administrator. Please contact the software owner.
                </p>
              </div>
            </div>
          ) : status === 'clock_rollback' ? (
            <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="text-sm font-bold text-red-900">
                  Clock Manipulation Detected
                </p>
                <p className="text-xs text-red-700">
                  System clock manipulation detected. Please set your computer&apos;s date and time correctly.
                </p>
              </div>
            </div>
          ) : status === 'expired' ? (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-3">
              <span className="text-2xl">⏳</span>
              <div>
                <p className="text-sm font-bold text-amber-900">
                  License Expired
                </p>
                <p className="text-xs text-amber-700">
                  Your software license has expired. Please contact the administrator to renew.
                </p>
              </div>
            </div>
          ) : status === 'offline' ? (
            <div className="bg-orange-50 border border-orange-200 p-4 rounded-2xl flex items-center gap-3">
              <span className="text-2xl">🌐</span>
              <div>
                <p className="text-sm font-bold text-orange-900">
                  Internet Connection Required
                </p>
                <p className="text-xs text-orange-700">
                  An active internet connection is required for initial activation. Please connect to the internet and click &quot;Check Status Now&quot;.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-amber-500 animate-ping shrink-0" />
              <div>
                <p className="text-sm font-bold text-amber-900">
                  Activation Request Sent • Pending Owner Approval
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Your system details and Activation Key have been submitted to the administrator. The application will unlock automatically once approved.
                </p>
              </div>
            </div>
          )}

          {/* Machine Hardware & Key Details Card */}
          <div className="bg-gray-50/80 rounded-2xl p-4 sm:p-5 border border-gray-200 space-y-3">
            <h3 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">
              System & Device Information
            </h3>

            {/* Activation Key */}
            <div className="bg-white p-3 rounded-xl border border-gray-200 flex items-center justify-between gap-3 shadow-sm">
              <div>
                <span className="text-[11px] text-gray-400 font-bold uppercase block">
                  Activation Key
                </span>
                <span className="font-mono text-sm sm:text-base font-extrabold text-[#07502f] tracking-wide select-all">
                  {machineInfo.activationKey || 'Generating...'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(machineInfo.activationKey, 'key')}
                className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-colors flex items-center gap-1 shrink-0"
              >
                <span>{copiedType === 'key' ? '✓ Copied' : '📋 Copy'}</span>
              </button>
            </div>

            {/* MAC Address & Hostname in 2 Columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="bg-white p-3 rounded-xl border border-gray-200 flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">
                    MAC Address
                  </span>
                  <span className="font-mono font-bold text-gray-800 select-all">
                    {machineInfo.macAddress || 'Detecting...'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(machineInfo.macAddress, 'mac')}
                  className="text-gray-400 hover:text-gray-700 text-xs font-bold"
                  title="Copy MAC"
                >
                  {copiedType === 'mac' ? '✓' : '📋'}
                </button>
              </div>

              <div className="bg-white p-3 rounded-xl border border-gray-200 flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">
                    Computer Name
                  </span>
                  <span className="font-bold text-gray-800 truncate max-w-[140px] block">
                    {machineInfo.hostname || 'Detecting...'}
                  </span>
                </div>
                <span className="text-gray-400">💻</span>
              </div>
            </div>
          </div>

          {/* Action Button: Check Status */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={checkLicense}
              disabled={checking}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#07502f] hover:bg-[#0b5d38] text-white font-bold text-sm shadow-lg shadow-emerald-950/20 transition-all flex items-center justify-center gap-2"
            >
              <span className={checking ? 'animate-spin' : ''}>🔄</span>
              <span>{checking ? 'Checking Status...' : 'Check Status Now'}</span>
            </button>

            <p className="text-center text-[11px] text-gray-400 leading-relaxed">
              Once activated, the application operates <strong className="text-gray-600">100% OFFLINE</strong> without requiring internet.
            </p>
          </div>

          {/* Emergency Manual Master Key Accordion */}
          <div className="pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setShowManualKey(!showManualKey)}
              className="text-[11px] font-bold text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1 mx-auto"
            >
              <span>⚙️ Owner Master Key Override</span>
              <span>{showManualKey ? '▴' : '▾'}</span>
            </button>

            {showManualKey && (
              <form onSubmit={handleManualActivate} className="mt-3 p-3 bg-gray-50 rounded-xl space-y-2 border">
                <input
                  type="password"
                  value={manualKey}
                  onChange={(e) => setManualKey(e.target.value)}
                  placeholder="Enter Master Key"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  disabled={manualLoading || !manualKey.trim()}
                  className="w-full py-2 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-black transition-colors"
                >
                  {manualLoading ? 'Activating...' : 'Activate with Master Key'}
                </button>
              </form>
            )}
          </div>

          {/* Feedback messages */}
          {error && (
            <p className="text-center text-xs font-bold text-red-600 animate-in fade-in">
              {error}
            </p>
          )}
          {message && status === 'active' && (
            <p className="text-center text-xs font-bold text-emerald-600 animate-in fade-in">
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
