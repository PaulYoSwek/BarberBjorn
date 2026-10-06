import { json, readJson, servePost } from '../_shared/http.ts'
import { safeEqual, sessionCookieFor, sessionToken } from '../_shared/session.ts'

servePost(async (req) => {
  const body = await readJson(req)
  let password = ''
  if (body && typeof body === 'object' && 'password' in body) {
    const value = (body as { password?: unknown }).password
    if (typeof value === 'string') password = value
  }
  const expected = Deno.env.get('ADMIN_PASSWORD') ?? ''
  const matches = safeEqual(password, expected)
  if (!matches || expected.length === 0) return json(req, 401, { ok: false, error: 'unauthorized' })
  const { token, exp } = await sessionToken()
  return json(req, 200, { ok: true, token, exp }, { 'Set-Cookie': sessionCookieFor(token) })
})
