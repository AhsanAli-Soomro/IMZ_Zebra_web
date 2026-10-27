'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { post } from '../../lib/axiosService'

export default function LoginPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [errorMessage, setErrorMessage] = useState('')
  const [deviceError, setDeviceError] = useState('')
  const [loading, setLoading] = useState(false)
  const [companyData, setCompanyData] = useState(null)
  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  const getCompanyData = async () => {
    try {
      const res = await fetch('/api/company-profile')
      const data = await res.json()
      setCompanyData(data)

    } catch (error) {
      console.error('Failed to fetch company data:', error)
    }
  }

  useEffect(() => {
    getCompanyData()

    async function checkDeviceStatus() {
      try {
        let machineInfo = {}
        if (typeof window !== 'undefined' && window.electronAPI?.getMachineInfo) {
          machineInfo = await window.electronAPI.getMachineInfo()
        }
        if (machineInfo?.machineId) {
          const res = await fetch('/api/devices/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              device_id: machineInfo.machineId,
              mac_address: machineInfo.macAddress,
              device_name: machineInfo.hostname,
              device_role: 'Counter',
            }),
          })
          const data = await res.json()
          if (!res.ok || !data.ok) {
            setDeviceError(data.message || 'This computer is not authorized to access Zebra IMS.')
          }
        }
      } catch (err) {
        console.warn('Device status check notice:', err)
      }
    }
    checkDeviceStatus()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage('')
    setLoading(true)

    try {
      const response = await post('/api/login', formData)

      if (response.success) {
        const user = response.user

        if (user.status && user.status !== 'active') {
          window.localStorage.removeItem('authToken')
          router.push('/inactive')
          return
        }

        window.localStorage.setItem('authToken', response.token || '')
        window.localStorage.setItem('user', JSON.stringify(user))

        if (user.user_type === 'Admin') {
          router.push('/dashboard')
        } else if (user.user_type === 'Employee') {
          router.push('/billing')
        } else {
          setErrorMessage('Unknown user type')
        }
      } else {
        setErrorMessage(response.message || 'Invalid credentials')
      }
    } catch (error) {
      setErrorMessage('Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center ">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded shadow-md w-full max-w-sm"
      >
        <div className="flex flex-col items-center">
          <img
            src={loading ? '/loading.gif' : (companyData?.logo_url || '/default-logo.png')}
            alt={loading ? 'Loading...' : (companyData?.company_name || 'Zebra IMS')}
            className='w-24 h-auto mb-2 object-contain max-h-24'
          />
          <h3 className="text-2xl font-semibold mb-4 text-center">
            {companyData?.company_name || 'Zebra IMS'}
          </h3>
        </div>
        <h1 className="text-xl font-semibold mb-6">Login</h1>

        {deviceError && (
          <div className="bg-red-50 border border-red-300 text-red-800 text-xs p-3 rounded-lg mb-4 font-semibold leading-relaxed">
            🚫 {deviceError}
          </div>
        )}

        {errorMessage && (
          <p className="text-red-500 mb-4">{errorMessage}</p>
        )}

        <input
          type="email"
          name="email"
          placeholder="Email"
          value={formData.email}
          onChange={handleChange}
          required
          className="border p-2 mb-4 w-full"
        />

        <input
          type="password"
          name="password"
          placeholder="Password"
          value={formData.password}
          onChange={handleChange}
          required
          className="border p-2 mb-4 w-full"
        />

        <button
          type="submit"
          disabled={loading || Boolean(deviceError)}
          className="bg-blue-600 text-white w-full py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Logging in...' : deviceError ? 'Device Not Authorized' : 'Login'}
        </button>

        <div className="mt-4 text-center border-t pt-3">
          <button
            type="button"
            onClick={() => router.push('/network-setup')}
            className="text-[11px] text-gray-400 hover:text-emerald-700 font-semibold transition-colors"
          >
            ⚙️ Network Mode / Server Settings
          </button>
        </div>
      </form>
    </div>
  )
}