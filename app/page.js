'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    let mounted = true

    // Cloud Vercel deployment: acts strictly as the License Server & Admin Portal
    if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
      router.replace('/admin')
      return
    }

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

        // 2. Check License Activation
        if (typeof window !== 'undefined' && window.electronAPI?.licenseCheck) {
          const result = await window.electronAPI.licenseCheck()
          if (!mounted) return

          if (result?.ok) {
            router.replace('/login')
          } else {
            router.replace('/activate')
          }
          return
        }

        // Web Browser / LAN Node fallback: Check server license status over API
        try {
          const res = await fetch('/api/license/status', { cache: 'no-store' })
          const statusData = await res.json()
          if (!mounted) return

          if (statusData?.ok && statusData?.active) {
            router.replace('/login')
          } else {
            router.replace('/activate')
          }
        } catch {
          if (mounted) router.replace('/activate')
        }
      } catch (err) {
        console.warn('Home check error:', err)
        if (mounted) router.replace('/activate')
      }
    }

    check()

    return () => {
      mounted = false
    }
  }, [router])

  return null
}