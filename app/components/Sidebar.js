'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getStoredUser } from '@/lib/storage'

export default function Sidebar({ active, setActive, isOpen }) {
  const router = useRouter()
  const [userType, setUserType] = useState(null)
  const [openMenus, setOpenMenus] = useState({
    Customers: false,
    Suppliers: false,
  })

  useEffect(() => {
    const user = getStoredUser()
    setUserType(user?.user_type || null)
  }, [])

  useEffect(() => {
    if (['Customers', 'Customer Ledger'].includes(active)) {
      setOpenMenus((current) => ({ ...current, Customers: true }))
    }
    if (['Suppliers', 'Supplier Ledger'].includes(active)) {
      setOpenMenus((current) => ({ ...current, Suppliers: true }))
    }
  }, [active])

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
    {
      label: 'Customers',
      children: ['Customers', 'Customer Ledger'],
    },
    'Sale Invoice',
    'Purchase Invoice',
    {
      label: 'Suppliers',
      children: ['Suppliers', 'Supplier Ledger'],
    },
    'Categories',
    ...(userType === 'Employee' ? [] : ['Employees']),
    'Billing History',
    'Daily Ledger',
    'Cash Information',
    'Cash in Hand',
    'Bank Management',
    'Report and Analytics',
    'Expenses',
    'Calculator',
    // 'Import Export Data',
    // 'Settings',
  ]

  return (
    <aside
      className={`bg-gray-900 text-white w-64 p-4 pb-6 flex flex-col h-full overflow-hidden ${isOpen ? 'flex' : 'hidden md:flex'
        }`}
      style={{ height: 'calc(100dvh - 130px)' }}
    >
      <h2 className="text-xl font-bold mb-6 shrink-0">Menu</h2>
      <div className="flex-1 overflow-y-auto max-h-full h-0 pr-1 space-y-2 custom-scrollbar">
        {menuItems.map((item) => {
          if (typeof item === 'string') {
            return (
              <button
                key={item}
                onClick={() => setActive(item)}
                className={`block w-full text-left px-3 py-2 rounded shrink-0 ${
                  active === item ? 'bg-indigo-600' : 'hover:bg-gray-800'
                }`}
              >
                {item}
              </button>
            )
          }

          const isExpanded = openMenus[item.label]

          return (
            <div key={item.label}>
              <button
                type="button"
                onClick={() =>
                  setOpenMenus((current) => ({
                    ...current,
                    [item.label]: !isExpanded,
                  }))
                }
                className={`flex w-full items-center justify-between rounded px-3 py-2 text-left ${
                  item.children.some((child) => active === child)
                    ? 'bg-gray-800'
                    : 'hover:bg-gray-800'
                }`}
              >
                <span>{item.label}</span>
                <span className={`text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>

              {isExpanded && (
                <div className="mt-1 space-y-1 border-l border-gray-700 pl-3">
                  {item.children.map((child) => (
                    <button
                      key={child}
                      type="button"
                      onClick={() => setActive(child)}
                      className={`block w-full rounded px-3 py-2 text-left text-sm ${
                        active === child ? 'bg-indigo-600' : 'text-gray-300 hover:bg-gray-800'
                      }`}
                    >
                      {child === item.label ? `${item.label} List` : child}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </aside>
  )
}
