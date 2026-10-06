import { isSchemaMissing } from '../_shared/clients.ts'
import { serviceClient } from '../_shared/db.ts'
import { json, rejectUnlessSession, servePost } from '../_shared/http.ts'

servePost(async (req) => {
  const denied = await rejectUnlessSession(req)
  if (denied) return denied
  const db = serviceClient()
  const columns = 'id, service, name, email, phone, start, minutes, kind, status, lang, mail_sent'
  const list = (withPrice: boolean) =>
    db
      .from('bookings')
      .select(withPrice ? `${columns}, price` : columns)
      .order('created_at', { ascending: false })
  let listed = await list(true)
  // Before the clients migration there is no price column yet.
  if (listed.error && isSchemaMissing(listed.error)) listed = await list(false)
  if (listed.error) throw new Error(listed.error.message)
  return json(req, 200, listed.data ?? [])
})
