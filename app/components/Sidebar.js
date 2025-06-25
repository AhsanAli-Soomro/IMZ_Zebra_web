'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function Sidebar({ active, setActive, isOpen }) {
  const router = useRouter()
  const [userType, setUserType] = useState(null)

  // Get user type on mount
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'))
    if (user?.user_type) {
      setUserType(user.user_type)
    }
  }, [])

  const allItems = [
    'Dashboard',
    'Stock',
    'Categories',
    'Customers',
    'Suppliers',
    'Inventory',
    'Employees',
    'Billing History',
    'Profile',
  ]

  const items = userType === 'Employee'
    ? allItems.filter(item => item !== 'Employees')
    : allItems

  const handleLogout = () => {
    localStorage.removeItem('authToken')
    localStorage.removeItem('user')
    router.push('/login')
  }

  return (
    <>
      {/* ✅ Mobile backdrop — just closes sidebar */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden transition-opacity"
          onClick={() => setActive(prev => prev)} // 👈 Or close handler if available
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:static z-40 w-64 h-full bg-white border-r shadow-lg transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0 top-16' : '-translate-x-full md:translate-x-0 top-16'
        }`}
      >
        <div className="flex flex-col justify-between h-full p-4 bg-gray-50">
          {/* Navigation */}
          <nav className="space-y-1">
            {items.map((item) => (
              <button
                key={item}
                onClick={() => setActive(item)}
                className={`w-full text-left px-4 py-2 rounded-md font-medium transition-all duration-200 ${
                  active === item
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-gray-700 hover:bg-indigo-100'
                }`}
              >
                {item}
              </button>
            ))}
          </nav>

          {/* Logout */}
          <div className="pt-4 border-t mt-4">
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-sm bg-red-500 text-white rounded-md hover:bg-red-600 transition"
            >
              🔒 Logout
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
