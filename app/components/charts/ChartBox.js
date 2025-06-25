'use client'

export default function ChartBox({ title, children, icon = null, footer = null }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col h-[420px] w-full transition-all hover:shadow-md">
      
      {/* Header */}
      <div className="mb-4 flex items-center space-x-2 text-lg font-semibold text-gray-700">
        {icon && <span className="text-xl">{icon}</span>}
        <span>{title}</span>
      </div>

      {/* Chart / Content */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>

      {/* Optional Footer */}
      {footer && (
        <div className="pt-3 mt-4 border-t text-sm text-gray-500">
          {footer}
        </div>
      )}
    </div>
  )
}
