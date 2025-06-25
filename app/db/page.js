"use client"
import React, { useEffect, useState } from 'react'
import DBmanagement from '../components/DBmanagement'
import Navbar from '../components/Navbar'

export default function Page() {
  const [isAuth, setIsAuth] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('authToken')
    if (!token) {
      console.log('No token found')
      window.location.href = '/login'
    } else {
      setIsAuth(true)
    }
  }, [])

  if (!isAuth) return null

  return (
<div className="min-h-screen bg-gray-100">
  {/* ✅ Persistent Top Navbar */}
  <Navbar />

  {/* ✅ Page Container */}
  <div className="max-w-6xl mx-auto px-4 py-10">
    <div className="bg-white w-full rounded-2xl shadow-md p-8 border border-gray-200">
      <h1 className="text-3xl font-bold text-indigo-700 mb-2 flex items-center gap-2">
        📦 Database Management
      </h1>
      <p className="text-gray-600 mb-6 text-sm md:text-base">
        Easily import or export your database tables in CSV format. Use this tool to back up or restore data with confidence.
      </p>

      {/* ✅ Main Tool */}
      <DBmanagement />
    </div>
  </div>
</div>

  )
}
