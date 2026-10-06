/**
 * The admin session on this device. The edge functions issue a signed
 * `exp.signature` token on login. We keep it in localStorage so Bjorn stays
 * signed in on his phone, and send it as a header on every function call
 * (the httpOnly cookie is still sent too, where the browser allows it).
 */
const FLAG_KEY = 'barber-admin'
const TOKEN_KEY = 'barber-admin-token'
export const SESSION_HEADER = 'x-admin-session'

function stores(): Storage[] {
  const found: Storage[] = []
  try {
    found.push(localStorage)
  } catch {
    /* storage blocked */
  }
  try {
    found.push(sessionStorage)
  } catch {
    /* storage blocked */
  }
  return found
}

function tokenExpired(token: string): boolean {
  const dot = token.indexOf('.')
  if (dot <= 0) return true
  const exp = Number(token.slice(0, dot))
  if (!Number.isFinite(exp)) return true
  return exp <= Math.floor(Date.now() / 1000)
}

export function readAdminToken(): string | null {
  for (const store of stores()) {
    const token = store.getItem(TOKEN_KEY)
    if (!token) continue
    if (tokenExpired(token)) {
      clearAdminSession()
      return null
    }
    return token
  }
  return null
}

export function hasAdminSession(): boolean {
  if (readAdminToken()) return true
  return stores().some((store) => store.getItem(FLAG_KEY) === '1')
}

export function storeAdminSession(token?: string | null) {
  for (const store of stores()) {
    store.setItem(FLAG_KEY, '1')
    if (token && !tokenExpired(token)) store.setItem(TOKEN_KEY, token)
  }
}

export function clearAdminSession() {
  for (const store of stores()) {
    store.removeItem(FLAG_KEY)
    store.removeItem(TOKEN_KEY)
  }
}
