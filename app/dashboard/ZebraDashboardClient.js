'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Sidebar from '../components/Sidebar'
import Navbar from '../components/Navbar'
import Stock from '../components/Stock'
import Stores from '../components/Stores'
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
import CustomerLedger from '../components/CustomerLedger'
import SupplierLedger from '../components/SupplierLedger'
import BulkBalanceEntry from '../components/BulkBalanceEntry'
import AIAdvisor from '../components/AIAdvisor'
import Quotations from '../components/Quotations'
import AdvancedExcelSync from '../components/AdvancedExcelSync'
import AutoBackup from '../components/AutoBackup'

export default function ZebraDashboardClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedCustomerId, setSelectedCustomerId] = useState(null)
  const [selectedSupplierId, setSelectedSupplierId] = useState(null)
  const [active, setActive] = useState(null)
  const [isAuth, setIsAuth] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
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

  const isAdvancedAllowed = (moduleName) => {
    if (typeof window === 'undefined') return false
    try {
      const raw = window.localStorage.getItem('zebra_allowed_tabs')
      if (!raw) return false
      const tabs = JSON.parse(raw)
      return Array.isArray(tabs) && tabs.includes(moduleName)
    } catch {
      return false
    }
  }

  const renderContent = () => {
    switch (active?.toLowerCase()) {
      case 'dashboard':
        return <DashboardPage />
      case 'stock':
        return <Stock />
      case 'stores':
        return <Stores />
      case 'inventory':
        return <Inventory />
      case 'customers':
        return (
          <BulkBalanceEntry
            type="customer"
            onOpenLedger={() => setActive('Customer Ledger')}
            onOpenKhata={(id) => {
              setSelectedCustomerId(id)
              setActive('Customer Khata')
            }}
          />
        )
      case 'customer khata':
        return <CustomerKhata customerId={selectedCustomerId} />
      case 'customer ledger':
        return <CustomerLedger />
      case 'sale invoice':
        return <InvoiceCreate />
      case 'purchase invoice':
        return <PurchaseInvoice />
      case 'suppliers':
        return (
          <BulkBalanceEntry
            type="supplier"
            onOpenLedger={() => setActive('Supplier Ledger')}
            onOpenKhata={(id) => {
              setSelectedSupplierId(id)
              setActive('Supplier Khata')
            }}
          />
        )
      case 'supplier khata':
        return <SupplierKhata supplierId={selectedSupplierId} />
      case 'supplier ledger':
        return <SupplierLedger />
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
      case 'bank management credit':
        return <BankManagement type="credit" />
      case 'bank management debit':
        return <BankManagement type="debit" />
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
      case 'ai advisor':
        return isAdvancedAllowed('AI Advisor') ? <AIAdvisor /> : <NotFound />
      case 'quotations':
        return isAdvancedAllowed('Quotations') ? <Quotations /> : <NotFound />
      case 'live excel':
        return isAdvancedAllowed('Live Excel') ? <AdvancedExcelSync /> : <NotFound />
      case 'auto backup':
        return isAdvancedAllowed('Auto Backup') ? <AutoBackup /> : <NotFound />
      default:
        return <DashboardPage />
    }
  }

  if (loading) return <div className="p-6">Loading...</div>
  if (!isAuth) return null

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <Navbar />

      <div className="md:hidden fixed left-3 top-3 z-[60]">
        <button
          className="h-10 w-10 rounded-lg border border-gray-200 bg-white text-gray-800 text-xl shadow-sm"
          onClick={() => setSidebarOpen(prev => !prev)}
          aria-label="Toggle navigation menu"
        >
          ☰
        </button>
      </div>

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
        />
      )}

      <div className="flex flex-1 overflow-hidden min-h-0">
        <Sidebar
          active={active}
          setActive={setActive}
          isOpen={sidebarOpen}
          onNavigate={() => setSidebarOpen(false)}
        />

        <main className="app-main flex-1 min-w-0 min-h-0 overflow-y-auto bg-gray-50 p-3 sm:p-4 lg:p-6">
          <ActivationGate>
            {renderContent()}
          </ActivationGate>
        </main>
      </div>
      <Footer />
    </div>
  )
}
