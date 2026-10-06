const COOKIE = 'barber_admin'
export const SESSION_HEADER = 'x-admin-session'
const MAX_AGE = 7 * 24 * 60 * 60

function secret(): string {
  const password = Deno.env.get('ADMIN_PASSWORD') ?? ''
  const extra = Deno.env.get('ADMIN_SESSION_SECRET') ?? ''
  return `${password}\n${extra}`
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

export function safeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a)
  const right = new TextEncoder().encode(b)
  const length = Math.max(left.length, right.length)
  let diff = left.length ^ right.length
  for (let index = 0; index < length; index++) {
    diff |= (left[index] ?? 0) ^ (right[index] ?? 0)
  }
  return diff === 0
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)))
  return bytesToBase64Url(signature)
}

/** A signed `exp.signature` token. Sent back as an httpOnly cookie and in the login body. */
export async function sessionToken(): Promise<{ token: string; exp: number }> {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE
  const payload = String(exp)
  return { token: `${payload}.${await sign(payload)}`, exp }
}

export function sessionCookieFor(token: string): string {
  return `${COOKIE}=${token}; Max-Age=${MAX_AGE}; Secure; HttpOnly; SameSite=None; Path=/`
}

export async function sessionCookie(): Promise<string> {
  const { token } = await sessionToken()
  return sessionCookieFor(token)
}

async function validToken(token: string): Promise<boolean> {
  // Without a password the signing key is guessable, so no session is ever valid.
  if (!(Deno.env.get('ADMIN_PASSWORD') ?? '')) return false
  const dot = token.indexOf('.')
  if (dot <= 0) return false
  const payload = token.slice(0, dot)
  const signature = token.slice(dot + 1)
  const expected = await sign(payload)
  if (!safeEqual(signature, expected)) return false
  const exp = Number(payload)
  if (!Number.isFinite(exp)) return false
  return exp > Math.floor(Date.now() / 1000)
}

function cookieToken(req: Request): string {
  const header = req.headers.get('Cookie') ?? ''
  const pair = header
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`))
  return pair ? pair.slice(COOKIE.length + 1) : ''
}

/**
 * The browser may send the session as a header (works when third-party cookies
 * are blocked, e.g. Safari) or as the httpOnly cookie. Either one is enough.
 */
export async function validSession(req: Request): Promise<boolean> {
  const fromHeader = req.headers.get(SESSION_HEADER)?.trim() ?? ''
  if (fromHeader && (await validToken(fromHeader))) return true
  const fromCookie = cookieToken(req)
  if (fromCookie && (await validToken(fromCookie))) return true
  return false
}
