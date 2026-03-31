export function getStoredUser() {
  if (typeof window === 'undefined') return null

  const rawUser = window.localStorage.getItem('user')
  if (!rawUser) return null

  try {
    return JSON.parse(rawUser)
  } catch {
    window.localStorage.removeItem('user')
    window.localStorage.removeItem('authToken')
    return null
  }
}