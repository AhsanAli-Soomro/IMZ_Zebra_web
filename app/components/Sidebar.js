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
    // 'Customer Khata',
    'Create Invoice',
    'Suppliers',
    'Categories',
    ...(userType === 'Employee' ? [] : ['Employees']),
    'Billing History',
    'Import Export Data',
    'Settings',
  ]

  return (
    <aside
      className={`bg-gray-900 text-white w-64 min-h-screen p-4 ${isOpen ? 'block' : 'hidden md:block'
        }`}
    >
      <h2 className="text-xl font-bold mb-6">Menu</h2>

      <div className="space-y-2">
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

      <button
        onClick={handleLogout}
        className="mt-6 w-full bg-red-600 px-3 py-2 rounded"
      >
        Logout
      </button>
    </aside>
  )
}