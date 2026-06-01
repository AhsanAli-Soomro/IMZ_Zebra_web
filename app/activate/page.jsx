'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ActivatePage() {
  const router = useRouter()
  const [key, setKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleActivate(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')

    try {
      if (!window?.electronAPI?.licenseActivate) {
        setError('Electron API not available')
        return
      }

      const result = await window.electronAPI.licenseActivate(key)

      if (result?.ok) {
        setMessage(result.message || 'Activated successfully')
        router.replace('/dashboard')
      } else {
        setError(result?.message || 'Activation failed')
      }
    } catch (err) {
      setError(err?.message || 'Activation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#f6f7fb',
        padding: '24px',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: '#fff',
          padding: '24px',
          borderRadius: '16px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
        }}
      >
        <h1 style={{ marginBottom: '8px' }}>Software Activation</h1>
        <p style={{ marginBottom: '20px', color: '#666' }}>
          Is system par software use karne ke liye activation key enter karein.
        </p>

        <form onSubmit={handleActivate}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
            Activation Key
          </label>

          <input
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Enter your activation key"
            style={{
              width: '100%',
              height: '44px',
              padding: '0 12px',
              border: '1px solid #d0d5dd',
              borderRadius: '10px',
              marginBottom: '14px',
              outline: 'none',
            }}
          />

          <button
            type="submit"
            disabled={loading || !key.trim()}
            style={{
              width: '100%',
              height: '44px',
              border: 'none',
              borderRadius: '10px',
              background: '#111827',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {loading ? 'Activating...' : 'Activate'}
          </button>
        </form>

        {message ? (
          <p style={{ color: 'green', marginTop: '14px' }}>{message}</p>
        ) : null}

        {error ? (
          <p style={{ color: 'crimson', marginTop: '14px' }}>{error}</p>
        ) : null}
      </div>
    </div>
  )
}