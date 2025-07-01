"use client"
import React, { useEffect, useState } from 'react'
import DBmanagement from '../components/DBmanagement'
import Navbar from '../components/Navbar'
import NotFound from '../components/404'

export default function Page() {
  const [isAuth, setIsAuth] = useState(false)
  const [userType, setUserType] = useState(null)

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'))
    if (!user) {
      console.log('No user found')
      window.location.href = '/login'
    } else {
      setIsAuth(true)
    }
    if(user.user_type){
      setUserType(user.user_type)
    }
  }, [])

  if (!isAuth ) return <NotFound />
  if (userType === 'Employee') return <NotFound />
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
