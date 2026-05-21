'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getStoredUser } from '@/lib/storage'

export default function Sidebar({ active, setActive, isOpen }) {
  const router = useRouter()
  const [userType, setUserType] = useState(null)

  useEffect(() => {
    const user = getStoredUser()
    setUserType(user?.user_type || null)
  }, [])

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('authToken')
      window.localStorage.removeItem('user')
    }
    router.replace('/login')
  }

  const menuItems = [
    'Dashboard',
    'Stock',
    'Inventory',
    'Customers',
    'Sale Invoice',
    'Purchase Invoice',
    'Suppliers',
    'Categories',
    ...(userType === 'Employee' ? [] : ['Employees']),
    'Billing History',
    'Cash Information',
    'Report and Analytics',
    // 'Import Export Data',
    'Settings',
  ]

  return (
    <aside
      className={`bg-gray-900 text-white w-64 p-4 pb-10 flex-col overflow-hidden ${isOpen ? 'flex' : 'hidden md:flex'
        }`}
      style={{ height: 'calc(100dvh - 64px)' }}
    >
      <h2 className="text-xl font-bold mb-6 shrink-0">Menu</h2>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item}
            onClick={() => setActive(item)}
            className={`block w-full text-left px-3 py-2 rounded ${active === item ? 'bg-indigo-600' : 'hover:bg-gray-800'
              }`}
          >
            {item}
          </button>
        ))}
      </div>
    </aside>
  )
}