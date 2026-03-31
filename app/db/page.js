'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DBmanagement from '../components/DBmanagement'
import Navbar from '../components/Navbar'
import NotFound from '../components/404'
import { getStoredUser } from '@/lib/storage'

export default function Page() {
  const router = useRouter()
  const [isAuth, setIsAuth] = useState(false)
  const [userType, setUserType] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const user = getStoredUser()

    if (!user) {
      router.replace('/login')
      setLoading(false)
      return
    }

    setIsAuth(true)
    setUserType(user?.user_type || null)
    setLoading(false)
  }, [router])

  if (loading) return <div className="p-6">Loading...</div>
  if (!isAuth) return null
  if (userType === 'Employee') return <NotFound />

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="bg-white w-full rounded-2xl shadow-md p-8 border border-gray-200">
          <h1 className="text-3xl font-bold text-indigo-700 mb-2 flex items-center gap-2">
            📦 Database Management
          </h1>
          <p className="text-gray-600 mb-6 text-sm md:text-base">
            Easily import or export your database tables in CSV format. Use this tool to back up or restore data with confidence.
          </p>

          <DBmanagement />
        </div>
      </div>
    </div>
  )
}