'use client'

import { useEffect, useState } from 'react'
export default function CompanyProfilePage() {
  const [form, setForm] = useState({
    company_name: '',
    company_code: '',
    city: '',
    branch: '',
    contact: '',
    address: '',
    company_email: '',
    existing_logo: '',
  })

  const [logoFile, setLogoFile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [userType, setUserType] = useState(null)

  useEffect(() => {
    const rawUser = window.localStorage.getItem('user')
    const user = rawUser ? JSON.parse(rawUser) : null
    if (user?.user_type) {
      setUserType(user.user_type)
    }
  }, [])

  useEffect(() => {
    const fetchProfile = async () => {
      const res = await fetch('/api/company-profile')
      const data = await res.json()

      setForm({
        company_name: data.company_name ?? '',
        company_code: data.company_code ?? '',
        city: data.city ?? '',
        branch: data.branch ?? '',
        contact: data.contact ?? '',
        address: data.address ?? '',
        company_email: data.company_email ?? '',
        existing_logo: data.logo_url ?? '',
      })

      setLoading(false)
    }

    fetchProfile()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()

    const body = new FormData()
    for (const key in form) {
      body.append(key, form[key])
    }

    if (logoFile) {
      body.append('logo', logoFile)
    }

    const res = await fetch('/api/company-profile', {
      method: 'POST',
      body,
    })
    const data = await res.json()

    if (res.ok) {
      alert('Profile updated!')
      window.location.reload()
    } else {
      alert(data.error || 'Failed to update')
    }
  }

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-8">
      {/* Header */}
      <div className="flex justify-between flex-wrap items-center border-b pb-4">
        <h1 className="text-3xl font-bold text-indigo-700 flex items-center gap-2">🏢 Company Profile</h1>
        {userType === 'Admin' && <button
          onClick={() => setIsEditing(!isEditing)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md shadow transition"
        >
          {isEditing ? 'Cancel' : 'Edit'}
        </button>}
      </div>


      {/* Profile Info Card */}
      <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          <div className="md:col-span-1 flex justify-center">
            {form.existing_logo ? (
              <img
                src={form.existing_logo}
                alt="Company Logo"
                className="h-32 w-32 object-contain rounded-lg bg-white border border-gray-300 ring-1 ring-gray-200 shadow"
              />

            ) : (
              <div className="h-32 w-32 bg-gray-100 flex items-center justify-center text-gray-400 border border-gray-300 rounded-lg">
                No Logo
              </div>
            )}
          </div>

          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            <ProfileField label="Company Name" value={form.company_name} />
            <ProfileField label="Company Code" value={form.company_code} />
            <ProfileField label="City" value={form.city} />
            <ProfileField label="Branch" value={form.branch} />
            <ProfileField label="Contact" value={form.contact} />
            <ProfileField label="Email" value={form.company_email} />
            <div className="md:col-span-2">
              <ProfileField label="Address" value={form.address} />
            </div>
          </div>
        </div>
      </div>
      {/* Edit Form */}
      {isEditing && (
        <form
          onSubmit={handleSubmit}
          encType="multipart/form-data"
          className="bg-white p-6 rounded-lg shadow border border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          <input type="hidden" name="existing_logo" value={form.existing_logo} />

          {[
            ['Company Name', 'company_name'],
            ['Company Code', 'company_code'],
            ['City', 'city'],
            ['Branch', 'branch'],
            ['Contact', 'contact'],
            ['Email', 'company_email'],
          ].map(([label, key]) => (
            <div key={key}>
              <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
              <input
                className="w-full border border-gray-300 p-2 rounded-md focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </div>
          ))}

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Address</label>
            <textarea
              className="w-full border border-gray-300 p-2 rounded-md focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"

              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Company Logo</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setLogoFile(e.target.files[0])}
              className="border-gray-300 rounded-md p-2 w-full shadow-sm file:mr-4 file:py-1 file:px-2 file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
          </div>

          <div>
            {form.existing_logo && (
              <img
                src={form.existing_logo}
                alt="Preview Logo"
                className="h-20 mt-2 border border-gray-300 rounded-lg"
              />
            )}
          </div>

          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md shadow-sm transition font-semibold"
            >
              ✅ Save Changes
            </button>

          </div>
        </form>
      )}
    </div>

  )
}

// ✅ Reusable Profile Field display
function ProfileField({ label, value }) {
  return (
    <div>
      <label className="text-sm text-gray-500">{label}</label>
      <p className="font-semibold text-gray-800">{value || '—'}</p>
    </div>
  )
}

