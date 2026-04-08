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
        if (!window?.electronAPI?.licenseCheck) {
          router.replace('/activate')
          return
        }

        const result = await window.electronAPI.licenseCheck()

        if (!mounted) return

        if (!result?.ok) {
          if (pathname !== '/activate') {
            router.replace('/activate')
          }
          return
        }

        setAllowed(true)
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
      <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
        Checking activation...
      </div>
    )
  }

  return children
}