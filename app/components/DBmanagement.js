import React from 'react'
import DBExport from './DBExport'
import DBImport from './DBImport'

export default function DBmanagement() {
  return (
<div className="flex flex-col md:flex-row gap-6 md:gap-10 w-full">
  {/* Export Section */}
  <section className="flex-1 bg-white rounded-xl shadow-md p-6 border border-gray-100 hover:shadow-lg transition-shadow duration-200">
    <h2 className="text-xl font-semibold text-blue-600 mb-4 flex items-center gap-2">
      📤 Export Data
    </h2>
    <DBExport />
  </section>

  {/* Import Section */}
  <section className="flex-1 bg-white rounded-xl shadow-md p-6 border border-gray-100 hover:shadow-lg transition-shadow duration-200">
    <h2 className="text-xl font-semibold text-green-600 mb-4 flex items-center gap-2">
      📥 Import Data
    </h2>
    <DBImport />
  </section>
</div>

  )
}
