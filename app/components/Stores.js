'use client'

import { useEffect, useMemo, useState } from 'react'
import StoreMovementHistory from './StoreMovementHistory'

const emptyStore = () => ({ store_code: '', name: '', address: '', status: 'Active' })

export default function Stores() {
  const [stores, setStores] = useState([])
  const [form, setForm] = useState(emptyStore)
  const [pendingStores, setPendingStores] = useState([])
  const [editingStore, setEditingStore] = useState(null)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  const loadStores = async () => {
    try {
      const response = await fetch('/api/stores')
      const json = await response.json()
      if (!response.ok || !json.success) throw new Error(json.message || 'Stores could not be loaded.')
      setStores(json.data || [])
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    }
  }

  useEffect(() => {
    loadStores()
  }, [])

  const filteredStores = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return stores
    return stores.filter((store) =>
      [store.store_code, store.name, store.address, store.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    )
  }, [stores, search])

  const addToList = (event) => {
    event.preventDefault()
    const storeCode = form.store_code.trim()
    const storeName = form.name.trim()
    if (!storeCode || !storeName) {
      setMessage({ type: 'error', text: 'Store code and store name are required.' })
      return
    }

    const codeExists = [...stores, ...pendingStores].some(
      (store) => String(store.store_code).toLowerCase() === storeCode.toLowerCase()
    )
    if (codeExists) {
      setMessage({ type: 'error', text: 'Store code already exists.' })
      return
    }

    setPendingStores((current) => [
      ...current,
      { ...form, store_code: storeCode, name: storeName, tempId: `${Date.now()}-${current.length}` },
    ])
    setForm(emptyStore())
    setMessage({ type: '', text: '' })
  }

  const saveAll = async () => {
    if (!pendingStores.length) return
    setSaving(true)
    setMessage({ type: '', text: '' })
    try {
      const response = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: pendingStores.map(({ tempId, ...store }) => store) }),
      })
      const json = await response.json()
      if (!response.ok || !json.success) throw new Error(json.message || 'Stores could not be saved.')
      const count = pendingStores.length
      setPendingStores([])
      await loadStores()
      setMessage({ type: 'success', text: `${count} store(s) successfully add ho gaye.` })
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setSaving(false)
    }
  }

  const updateStore = async (event) => {
    event.preventDefault()
    setSaving(true)
    setMessage({ type: '', text: '' })
    try {
      const response = await fetch('/api/stores', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingStore),
      })
      const json = await response.json()
      if (!response.ok || !json.success) throw new Error(json.message || 'Store could not be updated.')
      setEditingStore(null)
      await loadStores()
      setMessage({ type: 'success', text: 'Store successfully update ho gaya.' })
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setSaving(false)
    }
  }

  const deleteStore = async (id) => {
    if (!window.confirm('Is store ko delete karna hai?')) return
    try {
      const response = await fetch('/api/stores', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const json = await response.json()
      if (!response.ok || !json.success) throw new Error(json.message || 'Store could not be deleted.')
      await loadStores()
      setMessage({ type: 'success', text: 'Store delete ho gaya.' })
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    }
  }

  const storeFields = (value, setValue) => (
    <>
      <input value={value.store_code} onChange={(e) => setValue({ ...value, store_code: e.target.value })} required placeholder="Store Code" className="border border-gray-300 p-2 rounded-md w-full" />
      <input value={value.name} onChange={(e) => setValue({ ...value, name: e.target.value })} required placeholder="Store Name" className="border border-gray-300 p-2 rounded-md w-full" />
      <input value={value.address || ''} onChange={(e) => setValue({ ...value, address: e.target.value })} placeholder="Address" className="border border-gray-300 p-2 rounded-md w-full" />
      <select value={value.status} onChange={(e) => setValue({ ...value, status: e.target.value })} className="border border-gray-300 p-2 rounded-md w-full">
        <option value="Active">Active</option>
        <option value="Inactive">Inactive</option>
      </select>
    </>
  )

  return (
    <div className="p-3 sm:p-5 lg:p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold text-indigo-700 mb-6">🏪 Store Management</h1>

      {message.text && <div className={`mb-4 rounded-md px-4 py-3 text-sm border ${message.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>{message.text}</div>}

      <form onSubmit={addToList} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 bg-white p-4 sm:p-6 rounded-xl shadow-sm border mb-4">
        {storeFields(form, setForm)}
        <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-md shadow">Add to List</button>
      </form>

      <div className="bg-white border rounded-lg shadow mb-4 p-4 grid lg:grid-cols-[1fr_auto] gap-3 items-start">
        <div>
          <h2 className="font-semibold">Pending Store List ({pendingStores.length})</h2>
          <div className="mt-2 divide-y border rounded-lg">
            {pendingStores.length ? pendingStores.map((store, index) => (
              <div key={store.tempId} className="flex justify-between gap-3 p-3 text-sm">
                <span>{index + 1}. {store.store_code} — {store.name}{store.address ? ` — ${store.address}` : ''}</span>
                <button type="button" onClick={() => setPendingStores((rows) => rows.filter((row) => row.tempId !== store.tempId))} className="text-red-600">Remove</button>
              </div>
            )) : <p className="p-3 text-sm text-gray-500">Store form fill karke Add to List karein.</p>}
          </div>
        </div>
        <button type="button" onClick={saveAll} disabled={!pendingStores.length || saving} className="bg-green-600 disabled:bg-gray-400 text-white font-semibold rounded-lg px-5 py-2">{saving ? 'Saving...' : 'Save All Stores'}</button>
      </div>

      {editingStore && (
        <form onSubmit={updateStore} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4 bg-indigo-50 border border-indigo-200 p-4 rounded-lg mb-4">
          {storeFields(editingStore, setEditingStore)}
          <button disabled={saving} className="bg-indigo-600 text-white rounded-md px-4 py-2">Update Store</button>
          <button type="button" onClick={() => setEditingStore(null)} className="bg-gray-500 text-white rounded-md px-4 py-2">Cancel</button>
        </form>
      )}

      <div className="bg-white p-4 rounded-lg shadow">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search stores" className="border p-2 rounded-md w-full md:w-80 mb-4" />
        <div className="overflow-x-auto border rounded-md">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-indigo-600 text-white"><tr><th className="p-3">Code</th><th className="p-3">Store Name</th><th className="p-3">Address</th><th className="p-3">Status</th><th className="p-3 text-center">Actions</th></tr></thead>
            <tbody>
              {filteredStores.map((store, index) => (
                <tr key={store.id} className={index % 2 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="p-3">{store.store_code}</td><td className="p-3 font-medium">{store.name}</td><td className="p-3">{store.address || '-'}</td><td className="p-3">{store.status}</td>
                  <td className="p-3 text-center space-x-3"><button onClick={() => setEditingStore({ ...store })} className="text-indigo-600 hover:underline">Edit</button><button onClick={() => deleteStore(store.id)} className="text-red-600 hover:underline">Delete</button></td>
                </tr>
              ))}
              {!filteredStores.length && <tr><td colSpan={5} className="p-6 text-center text-gray-500">No stores found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <StoreMovementHistory compact />
    </div>
  )
}
