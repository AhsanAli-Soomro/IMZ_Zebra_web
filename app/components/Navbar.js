'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'

export default function Navbar() {
  const router = useRouter()
  const dropdownRef = useRef(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [userType, setUserType] = useState(null)
  const [user, setUser] = useState(null)

  const [profile, setProfile] = useState({
    company_name: '',
    branch: '',
    logo_url: '',
  })

  const pathname = usePathname()
  const isDashboard = pathname === '/billing'

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('user'))
    if (storedUser?.user_type) {
      setUserType(storedUser.user_type)
    }
    if (storedUser) {
      setUser(storedUser)
    }
  }, []) // ✅ run only once


  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/company-profile')
        if (!res.ok) throw new Error('Failed to load profile')
        const data = await res.json()
        setProfile({
          company_name: data.company_name ?? '',
          branch: data.branch ?? '',
          logo_url: data.logo_url ?? '',
        })
      } catch (err) {
        console.error('[Navbar] Error fetching profile:', err)
      }
    }

    fetchProfile()
  }, [])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('authToken')
    localStorage.removeItem('user')
    router.push('/login')
  }
  return (
    <header className="bg-white shadow sticky md:ml-0 ml-10 top-0 z-50 border-b border-gray-200">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* 🔵 Left: App Branding */}
          <div className="flex items-center space-x-1">
            {<img src="/zebra_logo.png" alt="Logo" className="w-16 bg-cover" /> || 
            <div className="bg-indigo-600 rounded-full w-10 h-10 flex items-center justify-center text-white font-bold text-lg">
              Z
            </div>}
            {/* <span className="text-xl font-bold text-gray-800">Zebra IMS</span> */}
          </div>

          {/* 🏢 Right: Company Info + Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center space-x-3 hover:bg-gray-100 px-3 py-2 rounded transition"
            >
              {profile.logo_url ? (
                <Image
                  src={profile.logo_url}
                  alt="Company Logo"
                  width={36}
                  height={36}
                  className="rounded object-contain"
                />
              ) : (
                <div className="h-9 w-9 bg-gray-200 rounded flex items-center justify-center text-gray-500 text-sm">
                  Logo
                </div>
              )}
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-800">{profile.company_name || 'Company'} ({user?.name || ''}) </p>
                <p className="text-xs text-gray-500">Branch: {profile.branch || '—'}</p>
              </div>
              <svg
                className="w-4 h-4 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-white rounded shadow border z-50 animate-fade-in">
                {isDashboard ? <button
                  onClick={() => {
                    setDropdownOpen(false)
                    router.push('/dashboard')
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-800 hover:bg-gray-100"
                >
                  Dashboard
                </button> : <button
                  onClick={() => {
                    setDropdownOpen(false)
                    router.push('/billing')
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-800 hover:bg-gray-100"
                >
                  Billing
                </button>}
                {userType === 'Admin' && <button
                  onClick={() => {
                    setDropdownOpen(false)
                    router.push('/db')
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-800 hover:bg-gray-100"
                >
                  Database Management
                </button>}
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                >
                  Logout
                </button>

              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
