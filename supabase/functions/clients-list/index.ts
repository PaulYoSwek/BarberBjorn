import { isSchemaMissing } from '../_shared/clients.ts'
import { serviceClient } from '../_shared/db.ts'
import { json, rejectUnlessSession, servePost } from '../_shared/http.ts'

servePost(async (req) => {
  const denied = await rejectUnlessSession(req)
  if (denied) return denied
  const db = serviceClient()
  const listed = await db.from('clients').select('id, name, email, phone, note, created_at').order('name')
  if (listed.error) {
    if (isSchemaMissing(listed.error)) return json(req, 200, { ok: true, ready: false, clients: [] })
    throw new Error(listed.error.message)
  }
  return json(req, 200, { ok: true, ready: true, clients: listed.data ?? [] })
})
