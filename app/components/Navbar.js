'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getStoredUser } from '@/lib/storage'

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
    <div className="w-full bg-white border-b px-6 py-4 flex justify-between items-center">
      <div className="flex items-center">
        <img
          src={companyLogo || '/default-logo.png'}
          alt="Company Logo"
          className="h-15 w-15 object-cover rounded-full mr-3"
        />
        <h1 className="text-lg font-semibold">{companyName}</h1>
      </div>

      <div className="flex items-center gap-4">
        {userType === 'Admin' && <button
          onClick={() => router.push(isDashboard ? '/billing' : '/dashboard')}
          className="text-black hover:text-indigo-600 transition cursor-pointer"
        >
          {isDashboard ? 'Billing' : 'Dashboard'}
        </button>}
        <span className="text-sm text-gray-600">
          {user?.name || 'User'}
        </span>
        <button
          onClick={handleLogout}
          className="bg-red-600 text-white px-4 py-2 rounded"
        >
          Logout
        </button>
      </div>
    </div>
  )
}