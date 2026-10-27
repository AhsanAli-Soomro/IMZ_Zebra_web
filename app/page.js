'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    let mounted = true

    async function check() {
      try {
        const result = await window.electronAPI.licenseCheck()
        if (!mounted) return

        if (result?.ok) {
          try {
            const profileRes = await fetch('/api/company-profile')
            const profile = await profileRes.json()
            if (!profile?.company_name || profile.company_name.trim() === '') {
              router.replace('/setup')
              return
            }
          } catch {}
          router.replace('/login')
        } else {
          router.replace('/activate')
        }
      } catch {
        router.replace('/activate')
      }
    }

    check()

    return () => {
      mounted = false
    }
  }, [router])

  // return <div style={{ padding: 24 }}>Loading...</div>
  return null
}