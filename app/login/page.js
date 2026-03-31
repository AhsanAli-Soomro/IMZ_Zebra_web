'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { post } from '../../lib/axiosService'

export default function LoginPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [errorMessage, setErrorMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

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
    <div className="min-h-screen flex justify-center items-center bg-gray-100">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded shadow-md w-full max-w-sm"
      >
        <h1 className="text-xl font-semibold mb-6">Login</h1>

        {errorMessage && <p className="text-red-500 mb-4">{errorMessage}</p>}

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
          disabled={loading}
          className="bg-blue-600 text-white w-full py-2 rounded hover:bg-blue-700"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  )
}