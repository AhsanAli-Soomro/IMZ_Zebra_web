'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NetworkSetupPage() {
  const router = useRouter()
  const [mode, setMode] = useState('server') // 'server' | 'counter'
  const [serverIp, setServerIp] = useState('')
  const [localIp, setLocalIp] = useState('127.0.0.1')
  const [deviceName, setDeviceName] = useState('')
  const [deviceRole, setDeviceRole] = useState('Counter')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadConfig() {
      try {
        if (typeof window !== 'undefined' && window.electronAPI?.getNetworkConfig) {
          const cfg = await window.electronAPI.getNetworkConfig()
          if (cfg?.mode) setMode(cfg.mode)
          if (cfg?.serverIp) setServerIp(cfg.serverIp)
          if (cfg?.localIp) setLocalIp(cfg.localIp)
        }
        if (typeof window !== 'undefined' && window.electronAPI?.getMachineInfo) {
          const info = await window.electronAPI.getMachineInfo()
          if (info?.hostname) {
            setDeviceName(info.hostname)
          }
        }
      } catch (err) {
        console.warn('Network config load error:', err)
      }
    }
    loadConfig()
  }, [])

  const handleTestConnection = async () => {
    if (!serverIp.trim()) {
      setError('Please enter the Main Server IP address.')
      return
    }

    setTesting(true)
    setError('')
    setTestResult(null)

    try {
      let target = serverIp.trim()
      if (!target.startsWith('http://') && !target.startsWith('https://')) {
        target = `http://${target}`
      }
      if (!target.includes(':', 7)) {
        target = `${target}:3002`
      }

      // 1. First test ping
      const pingRes = await fetch(`${target}/api/ping`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      })

      const pingData = await pingRes.json()
      if (!pingRes.ok || !pingData.ok) {
        throw new Error('Server returned an unexpected response.')
      }

      // 2. Perform handshake with device registration check
      let machineInfo = {}
      if (typeof window !== 'undefined' && window.electronAPI?.getMachineInfo) {
        machineInfo = await window.electronAPI.getMachineInfo()
      }

      const regRes = await fetch(`${target}/api/devices/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: machineInfo?.machineId || (typeof window !== 'undefined' ? window.localStorage.getItem('zebra_device_id') : null) || 'dev_' + Math.random().toString(36).substring(2, 9),
          mac_address: machineInfo?.macAddress || 'UNKNOWN-MAC',
          device_name: deviceName || machineInfo?.hostname || 'Counter PC',
          device_role: deviceRole || 'Counter',
        }),
        signal: AbortSignal.timeout(6000),
      })

      const regData = await regRes.json()

      if (!regRes.ok || !regData.ok) {
        setTestResult({
          success: false,
          blocked: true,
          error: regData.message || 'Access blocked. Computer limit reached or not authorized.',
          code: regData.code,
        })
        return
      }

      setTestResult({
        success: true,
        company: pingData.companyName || 'Zebra IMS Server',
        url: target,
        device: regData.device,
        currentCount: regData.current_count,
        maxDevices: regData.max_devices,
      })
    } catch (err) {
      setTestResult({
        success: false,
        error:
          'Could not connect to Main Server. Make sure the Main PC is running Zebra IMS and is on the same Wi-Fi/LAN.',
      })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')

    try {
      if (mode === 'counter') {
        if (!testResult?.success) {
          setError('Please test and verify the connection first.')
          setSaving(false)
          return
        }

        if (typeof window !== 'undefined' && window.electronAPI?.saveNetworkConfig) {
          await window.electronAPI.saveNetworkConfig({
            mode: 'counter',
            serverUrl: testResult.url,
            serverIp: serverIp.trim(),
            deviceRole,
            deviceName,
          })
        }

        // Navigate to the remote server's login
        window.location.href = `${testResult.url}/login`
        return
      }

      // Mode is Server
      if (typeof window !== 'undefined' && window.electronAPI?.saveNetworkConfig) {
        await window.electronAPI.saveNetworkConfig({
          mode: 'server',
        })
      }

      // Check if company profile is set
      try {
        const pRes = await fetch('/api/company-profile')
        const profile = await pRes.json()
        if (!profile?.company_name || profile.company_name.trim() === '') {
          router.replace('/setup')
          return
        }
      } catch {}

      router.replace('/login')
    } catch (err) {
      setError(err?.message || 'Failed to save network configuration.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#022315] via-[#07472a] to-[#041c11] flex items-center justify-center p-4 sm:p-6 font-sans text-gray-800">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-white/20">
        {/* Header */}
        <div className="bg-[#07502f] p-6 text-white text-center">
          <div className="w-14 h-14 bg-emerald-500/20 border border-emerald-400/40 rounded-2xl mx-auto flex items-center justify-center text-3xl mb-2 shadow-inner">
            🦓
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">
            Zebra IMS • Network Setup
          </h1>
          <p className="text-xs text-emerald-100/90 mt-1">
            Choose how this computer will operate in your shop, mill, or office
          </p>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl font-medium">
              ⚠️ {error}
            </div>
          )}

          {/* Mode Selector Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Server Card */}
            <div
              onClick={() => {
                setMode('server')
                setTestResult(null)
              }}
              className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                mode === 'server'
                  ? 'border-emerald-600 bg-emerald-50/50 shadow-md ring-2 ring-emerald-500/20'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-3xl">🖧</span>
                <input
                  type="radio"
                  name="mode"
                  checked={mode === 'server'}
                  onChange={() => setMode('server')}
                  className="w-4 h-4 text-emerald-600"
                />
              </div>
              <h3 className="text-sm font-bold text-gray-900">Main Server PC</h3>
              <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                Holds the database and runs the local server. Other Counter PCs on your Wi-Fi will connect to this PC.
              </p>
            </div>

            {/* Counter Card */}
            <div
              onClick={() => {
                setMode('counter')
                setTestResult(null)
              }}
              className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                mode === 'counter'
                  ? 'border-emerald-600 bg-emerald-50/50 shadow-md ring-2 ring-emerald-500/20'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-3xl">💻</span>
                <input
                  type="radio"
                  name="mode"
                  checked={mode === 'counter'}
                  onChange={() => setMode('counter')}
                  className="w-4 h-4 text-emerald-600"
                />
              </div>
              <h3 className="text-sm font-bold text-gray-900">Counter / Client PC</h3>
              <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                Connects to the Main Server over Wi-Fi/LAN. For billing counters, gate pass, or sales desks.
              </p>
            </div>
          </div>

          {/* Details for Selected Mode */}
          {mode === 'server' ? (
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 text-xs space-y-2">
              <div className="font-bold text-gray-800 flex items-center gap-1.5">
                <span>📶</span>
                <span>This PC&apos;s Local LAN IP Address:</span>
              </div>
              <div className="font-mono bg-white border border-gray-300 px-3 py-2 rounded-xl text-emerald-800 font-bold text-sm flex items-center justify-between">
                <span>{localIp}:3002</span>
                <span className="text-[10px] text-gray-400 font-sans font-normal">
                  (Type this on Counter PCs)
                </span>
              </div>
              <p className="text-[11px] text-gray-500 leading-tight">
                Other computers on your local Wi-Fi router will connect to this IP address.
              </p>
            </div>
          ) : (
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 text-xs space-y-3">
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Enter Main Server PC IP Address:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={serverIp}
                    onChange={(e) => setServerIp(e.target.value)}
                    placeholder="e.g. 192.168.1.15"
                    className="flex-1 px-3 py-2 rounded-xl border border-gray-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testing}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs transition-all disabled:bg-gray-400 shrink-0"
                  >
                    {testing ? 'Testing...' : 'Test LAN Connection'}
                  </button>
                </div>
              </div>

              {/* Computer Name & Role */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Computer Name / Identifier:
                  </label>
                  <input
                    type="text"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    placeholder="e.g. Counter-1 or Gate PC"
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    PC Role / Desk Type:
                  </label>
                  <select
                    value={deviceRole}
                    onChange={(e) => setDeviceRole(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Counter">Counter Desk (Billing & Sales)</option>
                    <option value="Gate">Gate Pass Desk</option>
                    <option value="Cashier">Cashier Desk</option>
                    <option value="Manager">Manager / Office PC</option>
                  </select>
                </div>
              </div>

              {testResult && (
                <div
                  className={`p-3 rounded-xl border text-xs font-semibold ${
                    testResult.success
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-red-50 border-red-300 text-red-800'
                  }`}
                >
                  {testResult.success ? (
                    <div>
                      <p className="font-bold flex items-center gap-1.5">
                        <span>✅</span>
                        <span>Connected & Authorized!</span>
                      </p>
                      <p className="text-[11px] text-emerald-700 mt-0.5">
                        Server: <strong>{testResult.company}</strong> ({testResult.url})
                      </p>
                      {testResult.maxDevices && (
                        <p className="text-[10px] text-emerald-600 mt-0.5">
                          💻 Device slot approved ({testResult.currentCount || 1} / {testResult.maxDevices} allowed PCs).
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="font-bold flex items-center gap-1.5">
                        <span>❌</span>
                        <span>{testResult.blocked ? 'Device Authorization Failed' : 'Connection Failed'}</span>
                      </p>
                      <p className="text-[11px] text-red-700 mt-0.5 leading-relaxed">{testResult.error}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="text-[11px] text-gray-400">
              {mode === 'server' ? 'Server will run on port 3002' : 'Connects instantly over LAN'}
            </span>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || (mode === 'counter' && !testResult?.success)}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-[#07502f] hover:from-emerald-500 hover:to-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <span>{saving ? 'Launching...' : 'Save & Launch Zebra IMS'}</span>
              <span>🚀</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
