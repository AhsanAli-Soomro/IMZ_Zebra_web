import React from 'react'

function Footer() {
  return (
    <div className="bg-gray-800 text-white py-3 text-center sm:text-end px-4 sm:px-6">
      <p className="text-xs sm:text-sm">&copy; {new Date().getFullYear()} Murtaza's Creative Solutions. All rights reserved.</p>
    </div>
  )
}

export default Footer
