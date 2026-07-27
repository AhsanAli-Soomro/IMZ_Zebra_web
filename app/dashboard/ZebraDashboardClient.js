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
import SupplierKhata from '../components/SupplierKhata'
import InvoiceCreate from '../components/InvoiceCreate'
import ActivationGate from '../components/ActivationGate'
import PurchaseInvoice from '../components/PurchaseInvoice'
import CashInformation from '../components/CashInformation'
import CounterClosing from '../components/CounterClosing'
import ReportsDashboard from '../components/ReportsDashboard'
import Footer from '../components/Footer'
import ProfitLossCalculator from '../components/Calculator'
import ExpensesPage from '../components/Expenses'
import BankManagement from '../components/BankManagement'
import DailyLedger from '../components/DailyLedger'

export default function ZebraDashboardClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedCustomerId, setSelectedCustomerId] = useState(null)
  const [selectedSupplierId, setSelectedSupplierId] = useState(null)
  const [active, setActive] = useState(null)
  const [isAuth, setIsAuth] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [userType, setUserType] = useState(null)

  useEffect(() => {
    const rawUser = window.localStorage.getItem('user')

    if (!rawUser) {
      router.replace('/login')
      return
    }

    try {
      const user = JSON.parse(rawUser)
      setIsAuth(true)
      setUserType(user?.user_type || null)
    } catch (err) {
      console.error('Invalid stored user:', err)
      window.localStorage.removeItem('user')
      window.localStorage.removeItem('authToken')
      router.replace('/login')
    } finally {
      setLoading(false)
    }
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
        return (
          <Suppliers
            setActive={setActive}
            setSelectedSupplierId={setSelectedSupplierId}
          />
        )
      case 'supplier khata':
        return <SupplierKhata supplierId={selectedSupplierId} />
      case 'categories':
        return <Categories />
      case 'employees':
        return userType === 'Employee' ? <NotFound /> : <Employees />
      case 'billing history':
        return <History />
      case 'daily ledger':
        return <DailyLedger />
      case 'cash information':
        return <CashInformation />
      case 'cash in hand':
        return <CounterClosing />
      case 'bank management':
        return <BankManagement />
      case 'report and analytics':
        return <ReportsDashboard />
      case 'import export data':
        return <DataImportExport />
      case 'settings':
        return <CompanyProfilePage />
      case 'calculator':
        return <ProfitLossCalculator />
      case 'expenses':
        return <ExpensesPage />
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
