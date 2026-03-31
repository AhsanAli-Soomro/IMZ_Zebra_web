import { Suspense } from 'react'
import ZebraDashboardClient from './ZebraDashboardClient'

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Loading dashboard...</div>}>
      <ZebraDashboardClient />
    </Suspense>
  )
}