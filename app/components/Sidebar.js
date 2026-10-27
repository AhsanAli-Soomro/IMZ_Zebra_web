'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getStoredUser } from '@/lib/storage'

export default function Sidebar({ active, setActive, isOpen, onNavigate }) {
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
    'Stores',
    'Inventory',
    { label: 'Customers', children: ['Customer Ledger'] },
    'Sale Invoice',
    'Purchase Invoice',
    { label: 'Suppliers', children: ['Supplier Ledger'] },
    'Categories',
    ...(userType === 'Employee' ? [] : ['Employees']),
    'Billing History',
    'Daily Ledger',
    'Cash Information',
    'Cash in Hand',
    'Bank Management Credit',
    'Bank Management Debit',
    'Report and Analytics',
    'Expenses',
    'Calculator',
    'Import Export Data',
    // 'Settings',
  ]

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 h-dvh bg-gray-900 text-white w-[min(82vw,18rem)] p-4 pb-6 flex-col overflow-hidden shadow-2xl transition-transform duration-200 md:static md:z-auto md:flex md:h-full md:w-64 md:translate-x-0 md:shadow-none ${isOpen ? 'flex translate-x-0' : 'hidden -translate-x-full md:flex'
        }`}
    >
      <div className="mb-5 flex shrink-0 items-center justify-between">
        <h2 className="text-xl font-bold">Menu</h2>
        <button type="button" onClick={onNavigate} className="rounded-lg px-3 py-1 text-2xl text-gray-300 hover:bg-gray-800 md:hidden" aria-label="Close menu">×</button>
      </div>
      <div className="flex-1 overflow-y-auto max-h-full h-0 pr-1 space-y-2 custom-scrollbar">
        {menuItems.map((item) => {
          if (typeof item === 'string') {
            return (
              <button
                key={item}
                onClick={() => {
                  setActive(item)
                  onNavigate?.()
                }}
                className={`block w-full text-left px-3 py-2 rounded shrink-0 ${
                  active === item ? 'bg-indigo-600' : 'hover:bg-gray-800'
                }`}
              >
                {item}
              </button>
            )
          }

          return (
            <div key={item.label} className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  setActive(item.label)
                  onNavigate?.()
                }}
                className={`block w-full text-left px-3 py-2 rounded shrink-0 ${
                  active === item.label || item.children?.includes(active) ? 'bg-indigo-600' : 'hover:bg-gray-800'
                }`}
              >
                {item.label}
              </button>
              <div className="ml-3 border-l border-gray-700 pl-2">
                {item.children?.map((child) => (
                  <button
                    key={child}
                    type="button"
                    onClick={() => {
                      setActive(child)
                      onNavigate?.()
                    }}
                    className={`block w-full rounded px-3 py-2 text-left text-sm ${
                      active === child ? 'bg-indigo-500 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    {child}
                  </button>
                ))}
              </div>
            </div>
          )

        })}
      </div>
    </aside>
  )
}
