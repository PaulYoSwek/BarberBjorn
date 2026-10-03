import { serviceClient } from '../_shared/db.ts'
import { json, readJson, rejectUnlessSession, servePost } from '../_shared/http.ts'
import { sendBookingMail, type MailKey } from '../_shared/notify.ts'
import { utcToSalonWall } from '../_shared/salon.ts'

const KEYS = new Set<MailKey>(['thanks', 'accepted', 'declined'])

function isKey(value: unknown): value is MailKey {
  return typeof value === 'string' && KEYS.has(value as MailKey)
}

servePost(async (req) => {
  const denied = await rejectUnlessSession(req)
  if (denied) return denied
  const body = await readJson(req)
  if (!body || typeof body !== 'object') return json(req, 400, { ok: false, error: 'invalid' })
  const record = body as { id?: unknown; key?: unknown; subject?: unknown; body?: unknown }
  const id = typeof record.id === 'string' ? record.id : ''
  if (!id || !isKey(record.key)) return json(req, 400, { ok: false, error: 'invalid' })
  const draft = {
    subject: typeof record.subject === 'string' ? record.subject : undefined,
    body: typeof record.body === 'string' ? record.body : undefined,
  }

  const db = serviceClient()
  const found = await db.from('bookings').select('id, service, name, email, start, lang').eq('id', id).maybeSingle()
  if (found.error) throw new Error(found.error.message)
  if (!found.data) return json(req, 404, { ok: false, error: 'missing' })
  const row = found.data as { id: string; service: string; name: string; email: string; start: string; lang: string }
  const result = await sendBookingMail(
    db,
    {
      id: row.id,
      email: row.email,
      name: row.name,
      service: row.service,
      start: utcToSalonWall(String(row.start)),
      lang: row.lang,
    },
    record.key,
    draft,
  )
  if (!result.sent) return json(req, 200, { ok: false, sent: false, error: 'unsent' })
  return json(req, 200, { ok: true, sent: true })
})
