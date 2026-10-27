'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    let mounted = true

    async function check() {
      try {
        // 1. Check if Company Profile has been set up first
        let hasCompany = false
        try {
          const profileRes = await fetch('/api/company-profile')
          const profile = await profileRes.json()
          if (profile?.company_name && profile.company_name.trim() !== '') {
            hasCompany = true
          }
        } catch {}

        if (!hasCompany) {
          if (mounted) router.replace('/setup')
          return
        }

        // 2. If company profile exists, check License Activation
        const result = await window.electronAPI.licenseCheck()
        if (!mounted) return

        if (result?.ok) {
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

  return null
}