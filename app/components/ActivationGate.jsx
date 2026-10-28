'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export default function ActivationGate({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    let mounted = true

    async function checkLicense() {
      try {
        // 1. Electron Desktop Environment
        if (window?.electronAPI?.licenseCheck) {
          const result = await window.electronAPI.licenseCheck()

          if (!mounted) return

          if (!result?.ok) {
            if (pathname !== '/activate') {
              router.replace('/activate')
            }
            return
          }

          setAllowed(true)
          return
        }

        // 2. Web Browser / LAN Counter Node Environment
        // Check with Main Server's activation status endpoint
        try {
          const storedDeviceId =
            typeof window !== 'undefined'
              ? window.localStorage.getItem('zebra_device_id')
              : ''
          const url = storedDeviceId
            ? `/api/license/status?device_id=${encodeURIComponent(storedDeviceId)}`
            : '/api/license/status'

          const res = await fetch(url, { cache: 'no-store' })
          const statusData = await res.json()

          if (!mounted) return

          if (statusData?.blocked) {
            router.replace('/login')
            return
          }

          if (statusData?.ok && statusData?.active) {
            setAllowed(true)
            return
          }
        } catch (fetchErr) {
          console.warn('Could not verify server license status over LAN:', fetchErr)
        }

        if (pathname !== '/activate') {
          router.replace('/activate')
        }
      } catch (err) {
        console.error('ActivationGate error:', err)
        if (pathname !== '/activate') {
          router.replace('/activate')
        }
      }
    }

    checkLicense()

    return () => {
      mounted = false
    }
  }, [router, pathname])

  if (!allowed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-gray-700 font-sans">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-bold text-gray-800">Verifying license authorization...</p>
        </div>
      </div>
    )
  }

  return children
}
