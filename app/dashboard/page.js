'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Sidebar from '../components/Sidebar'
import Navbar from '../components/Navbar'
import Stock from '../components/Stock'
import Customers from '../components/Customers'
import Suppliers from '../components/Suppliers'
import Inventory from '../components/Inventory'
import Employees from '../components/Employees'
import Categories from '../components/Categories'
import CompanyProfilePage from '../components/Profile'
import History from '../components/History'
import DashboardPage from '../components/Dashboard'
import NotFound from '../components/404'

export default function ZebraDashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [active, setActive] = useState(null)
  const [isAuth, setIsAuth] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [userType, setUserType] = useState(null)

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'))
    console.log(user)
    if (!user) {
      window.location.href = '/login'
    } else {
      setIsAuth(true)
    }
    if(user.user_type){
      setUserType(user.user_type)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (active !== null) return
    const viewParam = searchParams.get('view')
    const formatted = viewParam
      ? viewParam.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      : 'Dashboard'
    setActive(formatted)
  }, [searchParams, active])

  useEffect(() => {
    if (active) {
      const param = active.replace(/\s/g, '-').toLowerCase()
      const current = searchParams.get('view')
      if (current !== param) router.replace(`/dashboard?view=${param}`)
    }
  }, [active, router])

  const renderContent = () => {
    switch (active?.toLowerCase()) {
      case 'dashboard': return <DashboardPage />
      case 'stock': return <Stock />
      case 'inventory': return <Inventory />
      case 'customers': return <Customers />
      case 'suppliers': return <Suppliers />
      case 'categories': return <Categories />
      case 'employees': return(
        userType === 'Employee' ? <NotFound /> : <Employees />
      ) 
      case 'billing history': return <History />
      case 'profile': return <CompanyProfilePage />
      default: return <DashboardPage />
    }
  }

  if (loading) return <div className="p-6">Loading...</div>
  if (!isAuth) return null

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <Navbar />

      {/* 🔘 Toggle Button (Mobile) */}
      <div className="bg-white md:hidden fixed p-2 shadow z-50">
      <button
        className=" text-black text-2xl p-2 rounded"
        onClick={() => setSidebarOpen(prev => !prev)}
      >
        ☰
      </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Always Rendered */}
        <Sidebar active={active} setActive={setActive} isOpen={sidebarOpen} />

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6 bg-white">
          <Suspense fallback={<div>Loading content...</div>}>
            {renderContent()}
          </Suspense>
        </main>
      </div>
    </div>

  )
}
