export function getUser() {
  const data = localStorage.getItem('scamshield_user')
  if (!data) return null
  try { return JSON.parse(data) } catch { return null }
}

export function loginUser(userData) {
  localStorage.setItem('scamshield_user', JSON.stringify(userData))
}

export function logoutUser() {
  localStorage.removeItem('scamshield_user')
}
