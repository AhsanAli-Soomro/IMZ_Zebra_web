'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SetupPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    company_name: '',
    company_code: '',
    city: '',
    branch: '',
    contact: '',
    address: '',
    company_email: '',
    existing_logo: '',
    invoice_prefix: 'INV',
  })

  const [logoFile, setLogoFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch('/api/company-profile')
        const data = await res.json()
        if (data && data.company_name) {
          setForm({
            company_name: data.company_name || '',
            company_code: data.company_code || '',
            city: data.city || '',
            branch: data.branch || '',
            contact: data.contact || '',
            address: data.address || '',
            company_email: data.company_email || '',
            existing_logo: data.logo_url || '',
            invoice_prefix: data.invoice_prefix || 'INV',
          })
          if (data.logo_url) {
            setPreviewUrl(data.logo_url)
          }
        }
      } catch (err) {
        console.error('Failed to load profile:', err)
      } finally {
        setFetching(false)
      }
    }

    loadProfile()
  }, [])

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setLogoFile(file)
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.company_name.trim()) {
      setError('Company / Business name is required.')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const body = new FormData()
      body.append('company_name', form.company_name.trim())
      body.append('company_code', form.company_code.trim())
      body.append('city', form.city.trim())
      body.append('branch', form.branch.trim())
      body.append('contact', form.contact.trim())
      body.append('address', form.address.trim())
      body.append('company_email', form.company_email.trim())
      body.append('existing_logo', form.existing_logo || '')

      if (logoFile) {
        body.append('logo', logoFile)
      }

      const res = await fetch('/api/company-profile', {
        method: 'POST',
        body,
      })

      const result = await res.json()
      if (res.ok && result.success) {
        setSuccess('Setup completed successfully! Launching Zebra IMS...')
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('zebra_setup_done', 'true')
        }
        setTimeout(() => {
          router.replace('/login')
        }, 1200)
      } else {
        setError(result.error || 'Failed to save company profile.')
      }
    } catch (err) {
      setError(err?.message || 'Error saving setup information.')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-sm text-gray-500 font-bold">
          <span className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <span>Loading setup...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#022315] via-[#07472a] to-[#041c11] flex items-center justify-center p-4 sm:p-6 font-sans text-gray-800">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-white/20">
        {/* Top Header */}
        <div className="bg-[#07502f] p-6 sm:p-8 text-white relative">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-emerald-500/20 border border-emerald-400/40 rounded-2xl flex items-center justify-center text-3xl shadow-inner shrink-0">
              🦓
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                  Zebra IMS
                </h1>
                <span className="bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 text-[10px] uppercase px-2 py-0.5 rounded-full font-bold tracking-wider">
                  Initial Setup
                </span>
              </div>
              <p className="text-xs sm:text-sm text-emerald-100/90 mt-1">
                Enter your company information and logo to customize your invoices, receipts, and reports.
              </p>
            </div>
          </div>
        </div>

        {/* Setup Form */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <span>✅</span>
              <span>{success}</span>
            </div>
          )}

          {/* Section 1: Logo & Company Name */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center border-b pb-6">
            {/* Logo Upload Box */}
            <div className="text-center sm:text-left flex flex-col items-center sm:items-start">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Company Logo
              </label>
              <div className="relative group">
                <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-gray-300 hover:border-emerald-500 bg-gray-50 flex items-center justify-center overflow-hidden shadow-inner transition-colors">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Logo Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-2">
                      <span className="text-2xl block mb-1">🏢</span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase">
                        Upload
                      </span>
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleLogoChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  title="Click to upload logo"
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5 text-center sm:text-left leading-tight">
                Leave empty to use default Zebra IMS logo.
              </p>
            </div>

            {/* Company Name & Code */}
            <div className="sm:col-span-2 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Company / Business Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                  placeholder="e.g. Al-Madina Rice Mill / Traders"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Company Code / Short Name (Optional)
                </label>
                <input
                  type="text"
                  value={form.company_code}
                  onChange={(e) => setForm({ ...form, company_code: e.target.value })}
                  placeholder="e.g. AMR / HQ"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Contact & Address */}
          <div className="space-y-4">
            <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">
              Contact & Location Details (Printed on Invoices & Bills)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Phone / Mobile Number
                </label>
                <input
                  type="text"
                  value={form.contact}
                  onChange={(e) => setForm({ ...form, contact: e.target.value })}
                  placeholder="e.g. 0300-1234567"
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="e.g. Lahore / Gujranwala / Karachi"
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Business Address / Mill Location
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="e.g. Main G.T. Road, Grain Market"
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Company Email (Optional)
                </label>
                <input
                  type="email"
                  value={form.company_email}
                  onChange={(e) => setForm({ ...form, company_email: e.target.value })}
                  placeholder="e.g. info@business.com"
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-4 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-[11px] text-gray-400">
              This information will be displayed on all your receipts and reports.
            </p>

            <button
              type="submit"
              disabled={loading}
              className="py-3 px-6 bg-[#07502f] hover:bg-[#0b5d38] text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-950/20 transition-all flex items-center justify-center gap-2 shrink-0"
            >
              <span>{loading ? 'Saving Setup...' : 'Save & Launch Zebra IMS 🚀'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
