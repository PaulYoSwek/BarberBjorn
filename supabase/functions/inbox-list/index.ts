import { serviceClient } from '../_shared/db.ts'
import { json, rejectUnlessSession, servePost } from '../_shared/http.ts'

servePost(async (req) => {
  const denied = await rejectUnlessSession(req)
  if (denied) return denied
  const db = serviceClient()
  const listed = await db
    .from('bookings')
    .select('id, service, name, email, phone, start, minutes, kind, status, lang, mail_sent')
    .order('created_at', { ascending: false })
  if (listed.error) throw new Error(listed.error.message)
  return json(req, 200, listed.data ?? [])
})
