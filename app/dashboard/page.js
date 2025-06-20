'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '../components/Sidebar'
import Stock from '../components/Stock'
import Customers from '../components/Customers'
import Suppliers from '../components/Suppliers'
import Inventory from '../components/Inventory'
import Employees from '../components/Employees'
import Categories from '../components/Categories'
// import Profile from '../components/Profile'
// import Settings from '../components/Settings'

export default function ZebraDashboardPage() {
  const router = useRouter()
  const [active, setActive] = useState('Stock')
  const [isAuth, setIsAuth] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('authToken')
      if (!token) {
        router.push('/login')
      } else {
        setIsAuth(true)
      }
      setLoading(false)
    }

    checkAuth()
  }, [router])

  if (loading) return <div className="p-6">Checking authentication...</div>
  if (!isAuth) return null // avoids flicker

  const renderContent = () => {
    switch (active) {
      case 'Stock': return <Stock />
      case 'Inventory': return <Inventory />
      case 'Customers': return <Customers />
      case 'Suppliers': return <Suppliers />
      case 'Categories': return <Categories />
      case 'Employees': return <Employees />
      case 'Profile': return <Profile />
      case 'Settings': return <Settings />
      default: return <Stock />
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar active={active} setActive={setActive} />
      <main className="flex-1 p-6 overflow-auto">
        <Suspense fallback={<div>Loading content...</div>}>
          {renderContent()}
        </Suspense>
      </main>
    </div>
  )
}
