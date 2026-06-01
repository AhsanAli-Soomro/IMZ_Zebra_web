'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { post } from '../../lib/axiosService'

export default function LoginPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [resettingLicense, setResettingLicense] = useState(false)
  const [companyData, setCompanyData] = useState(null)
  const [checkingUsers, setCheckingUsers] = useState(true)
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
    const checkUsers = async () => {
      try {
        const res = await fetch('/api/users/count', {
          cache: 'no-store',
        })

        const data = await res.json()
        const usersCount = Number(data?.count || 0)

        if (usersCount === 0) {
          router.replace('/dashboard')
          return
        }

        setCheckingUsers(false)
        getCompanyData()
      } catch (error) {
        console.error('Failed to check users count:', error)
        setCheckingUsers(false)
        getCompanyData()
      }
    }

    checkUsers()
  }, [router])

  const handleResetLicense = async () => {
    setErrorMessage('')
    setSuccessMessage('')
    setResettingLicense(true)

    try {
      if (!window.electronAPI?.resetLicense) {
        setErrorMessage('License reset function not available')
        return
      }

      const result = await window.electronAPI.resetLicense()

      if (result?.ok) {
        window.localStorage.removeItem('authToken')
        window.localStorage.removeItem('user')
        setSuccessMessage('License reset ho gaya. App restart karein ya dobara activate karein.')
      } else {
        setErrorMessage(result?.message || 'License reset failed')
      }
    } catch (error) {
      console.error('License reset error:', error)
      setErrorMessage('License reset failed')
    } finally {
      setResettingLicense(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')
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
      console.error('Login error:', error)
      setErrorMessage('Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }
  if (checkingUsers) {
    return <div className="p-6">Loading...</div>
  }
  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded shadow-md w-full max-w-sm"
      >
        <div className="flex flex-col items-center">
          <img
            src={loading ? '/loading.gif' : companyData?.logo_url}
            alt={loading ? 'Loading...' : companyData?.company_name}
            className="w-24 h-auto mb-2"
          />
          <h3 className="text-2xl font-semibold mb-4">
            {companyData?.company_name || ''}
          </h3>
        </div>

        <h1 className="text-xl font-semibold mb-6">Login</h1>

        {errorMessage && (
          <p className="text-red-500 mb-4">{errorMessage}</p>
        )}

        {successMessage && (
          <p className="text-green-600 mb-4">{successMessage}</p>
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
          disabled={loading || resettingLicense}
          className="bg-blue-600 text-white w-full py-2 rounded hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>

        {/* <button
          type="button"
          onClick={handleResetLicense}
          disabled={loading || resettingLicense}
          className="mt-3 bg-red-600 text-white w-full py-2 rounded hover:bg-red-700 disabled:opacity-60"
        >
          {resettingLicense ? 'Resetting License...' : 'Reset License'}
        </button> */}
      </form>
    </div>
  )
}