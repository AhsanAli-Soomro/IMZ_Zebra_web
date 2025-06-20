'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function Sidebar({ active, setActive }) {
  const router = useRouter()
  const [userType, setUserType] = useState(null)

  // Get user type from localStorage on mount
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'))
    if (user && user.user_type) {
      setUserType(user.user_type)
    }
  }, [])

  // Define full list
  const allItems = ['Stock', 'Customers', 'Suppliers', 'Inventory', 'Employees', 'Profile', 'Settings']

  // Filter out 'Employees' if user is not Admin
  const items = userType === 'Employee' ? allItems.filter(item => item !== 'Employees') : allItems

  const handleLogout = () => {
    localStorage.removeItem('authToken')
    localStorage.removeItem('user')
    router.push('/login')
  }

  return (
    <aside className="w-64 bg-gray-100 p-4 min-h-screen flex flex-col justify-between">
      <div>
        <h2 className="text-xl font-bold mb-6">Zebra IMS</h2>
        <nav className="space-y-2">
          {items.map((item) => (
            <button
              key={item}
              onClick={() => setActive(item)}
              className={`block w-full text-left px-4 py-2 rounded ${
                active === item ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'
              }`}
            >
              {item}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-8">
        <button
          onClick={handleLogout}
          className="w-full text-left px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Logout
        </button>
      </div>
    </aside>
  )
}
