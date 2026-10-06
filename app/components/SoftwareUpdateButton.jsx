'use client'

import { useEffect, useState } from 'react'

const initialState = {
  status: 'idle',
  currentVersion: '',
  availableVersion: null,
  progress: 0,
  message: '',
}

export default function SoftwareUpdateButton() {
  const [update, setUpdate] = useState(initialState)

  useEffect(() => {
    const api = window?.electronAPI
    if (!api?.getUpdateState) return undefined

    let active = true
    const unsubscribe = api.onUpdateStatus?.(setUpdate)

    async function initializeUpdater() {
      try {
        const state = await api.getUpdateState()
        if (active) setUpdate(state)
        await api.checkForUpdates?.()
      } catch {}
    }

    initializeUpdater()

    return () => {
      active = false
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [])

  if (typeof window === 'undefined' || !window.electronAPI?.checkForUpdates) return null

  const handleClick = async () => {
    if (update.status === 'available') {
      await window.electronAPI.downloadUpdate()
      return
    }

    if (update.status === 'downloaded') {
      await window.electronAPI.installUpdate()
      return
    }

    await window.electronAPI.checkForUpdates()
  }

  const busy = update.status === 'checking' || update.status === 'downloading'
  const label =
    update.status === 'available'
      ? `Update software${update.availableVersion ? ` (${update.availableVersion})` : ''}`
      : update.status === 'downloaded'
        ? 'Restart & install update'
        : update.status === 'downloading'
          ? `Downloading ${update.progress}%`
          : update.status === 'checking'
            ? 'Checking updates...'
            : 'Check for updates'

  return (
    <div className="hidden sm:flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="whitespace-nowrap rounded-lg bg-indigo-600 px-3 py-2 text-xs lg:text-sm text-white transition hover:bg-indigo-700 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
      >
        {label}
      </button>
      {update.message && update.status !== 'checking' ? (
        <span
          className={`max-w-64 text-right text-xs ${
            update.status === 'error' ? 'text-red-600' : 'text-gray-500'
          }`}
        >
          {update.message}
        </span>
      ) : null}
    </div>
  )
}
