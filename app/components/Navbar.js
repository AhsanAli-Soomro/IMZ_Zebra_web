'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getStoredUser } from '@/lib/storage'
import SoftwareUpdateButton from './SoftwareUpdateButton'

export default function Navbar() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [companyName, setCompanyName] = useState('')
  const [companyLogo, setCompanyLogo] = useState(null)
  const [userType, setUserType] = useState('')
  const path = usePathname()
  const isDashboard = path === '/dashboard'
  const fetchProfile = async () => {
    const res = await fetch('/api/company-profile')
    const data = await res.json()
    setCompanyName(data.company_name || '')
    setCompanyLogo(data.logo_url || null)
    if (typeof document !== 'undefined' && data.company_name) {
      document.title = `${data.company_name} - Zebra IMS`
    }
  }
  useEffect(() => {
    const storedUser = getStoredUser()
    setUser(storedUser)
    setUserType(storedUser?.user_type || '')
    fetchProfile()
  }, [])



  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('authToken')
      window.localStorage.removeItem('user')
    }
    router.replace('/login')
  }

  return (
    <div className="relative z-30 w-full border-b bg-white py-3 pl-16 pr-3 sm:px-5 lg:px-6 flex flex-wrap justify-between items-center gap-3">
      <div className="flex min-w-0 items-center">
        <img
          src={companyLogo || '/default-logo.png'}
          alt="Company Logo"
          className="h-10 w-10 sm:h-12 sm:w-12 object-cover rounded-full mr-2 sm:mr-3 shrink-0"
        />
        <h1 className="truncate text-sm sm:text-lg font-semibold">{companyName}</h1>
      </div>

      <div className="flex items-center justify-end gap-2 sm:gap-4">
        <SoftwareUpdateButton />
        {userType === 'Admin' && <button
          onClick={() => router.push(isDashboard ? '/billing' : '/dashboard')}
          className="text-sm text-black hover:text-indigo-600 transition cursor-pointer"
        >
          {isDashboard ? 'Billing' : 'Dashboard'}
        </button>}
        <span className="hidden lg:inline text-sm text-gray-600">
          {user?.name || 'User'}
        </span>
        <button
          onClick={handleLogout}
          className="bg-red-600 text-white px-3 sm:px-4 py-2 rounded-lg text-sm"
        >
          Logout
        </button>
      </div>
    </div>
  )
}
