'use client'

import { useEffect, useState } from 'react'
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
import DataImportExport from '../db/page'
import CustomerKhata from '../components/CustomerKhata'
import InvoiceCreate from '../components/InvoiceCreate'
import ActivationGate from '../components/ActivationGate'
import PurchaseInvoice from '../components/PurchaseInvoice'
import CashInformation from '../components/CashInformation'
import ReportsDashboard from '../components/ReportsDashboard'
import Footer from '../components/Footer'
import ProfitLossCalculator from '../components/Calculator'

export default function ZebraDashboardClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [selectedCustomerId, setSelectedCustomerId] = useState(null)
  const [active, setActive] = useState(null)
  const [isAuth, setIsAuth] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [userType, setUserType] = useState(null)

  useEffect(() => {
    const checkUsersAndAuth = async () => {
      try {
        setLoading(true)

        const res = await fetch('/api/users/count', {
          cache: 'no-store',
        })

        const data = await res.json()
        const usersCount = Number(data?.count || 0)

        // Agar DB new hai aur ek bhi user nahi hai,
        // dashboard direct allow kar do.
        if (usersCount === 0) {
          setIsAuth(true)
          setUserType('Admin')
          setLoading(false)
          return
        }

        // Agar users available hain, phir login/auth required hai.
        const rawUser = window.localStorage.getItem('user')

        if (!rawUser) {
          router.replace('/login')
          return
        }

        try {
          const user = JSON.parse(rawUser)

          if (!user) {
            window.localStorage.removeItem('user')
            window.localStorage.removeItem('authToken')
            router.replace('/login')
            return
          }

          setIsAuth(true)
          setUserType(user?.user_type || null)
        } catch (err) {
          console.error('Invalid stored user:', err)
          window.localStorage.removeItem('user')
          window.localStorage.removeItem('authToken')
          router.replace('/login')
        }
      } catch (error) {
        console.error('Failed to check users count:', error)

        // Safety: agar users count API fail ho jaye,
        // auth required rakhein.
        const rawUser = window.localStorage.getItem('user')

        if (!rawUser) {
          router.replace('/login')
          return
        }

        try {
          const user = JSON.parse(rawUser)
          setIsAuth(true)
          setUserType(user?.user_type || null)
        } catch {
          window.localStorage.removeItem('user')
          window.localStorage.removeItem('authToken')
          router.replace('/login')
        }
      } finally {
        setLoading(false)
      }
    }

    checkUsersAndAuth()
  }, [router])

  useEffect(() => {
    if (active !== null) return

    const viewParam = searchParams.get('view')
    const formatted = viewParam
      ? viewParam.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      : 'Dashboard'

    setActive(formatted)
  }, [searchParams, active])

  useEffect(() => {
    if (!active) return

    const param = active.replace(/\s/g, '-').toLowerCase()
    const current = searchParams.get('view')

    if (current !== param) {
      router.replace(`/dashboard?view=${param}`)
    }
  }, [active, router, searchParams])

  const renderContent = () => {
    switch (active?.toLowerCase()) {
      case 'dashboard':
        return <DashboardPage />
      case 'stock':
        return <Stock />
      case 'inventory':
        return <Inventory />
      case 'customers':
        return (
          <Customers
            setActive={setActive}
            setSelectedCustomerId={setSelectedCustomerId}
          />
        )
      case 'customer khata':
        return <CustomerKhata customerId={selectedCustomerId} />
      case 'sale invoice':
        return <InvoiceCreate />
      case 'purchase invoice':
        return <PurchaseInvoice />
      case 'suppliers':
        return <Suppliers />
      case 'categories':
        return <Categories />
      case 'employees':
        return userType === 'Employee' ? <NotFound /> : <Employees />
      case 'billing history':
        return <History />
      case 'cash information':
        return <CashInformation />
      case 'report and analytics':
        return <ReportsDashboard />
      case 'import export data':
        return <DataImportExport />
      case 'settings':
        return <CompanyProfilePage />
      case 'calculator':
        return <ProfitLossCalculator />
      default:
        return <DashboardPage />
    }
  }

  if (loading) return <div className="p-6">Loading...</div>
  if (!isAuth) return null

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <Navbar />

      <div className="bg-white md:hidden fixed p-2 shadow z-50">
        <button
          className="text-black text-2xl p-2 rounded"
          onClick={() => setSidebarOpen(prev => !prev)}
        >
          ☰
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden min-h-0">
        <Sidebar active={active} setActive={setActive} isOpen={sidebarOpen} />

        <main className="flex-1 min-h-0 overflow-y-auto p-6 bg-white">
          <ActivationGate>
            {renderContent()}
          </ActivationGate>
        </main>
      </div>

      <Footer />
    </div>
  )
}