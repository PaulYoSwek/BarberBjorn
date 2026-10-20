import { serviceClient } from '../_shared/db.ts'
import { json, readJson, rejectUnlessSession, servePost } from '../_shared/http.ts'
import { MAIL_KEYS, templateFor } from '../../../src/mail-templates.ts'
import { sendBookingMail, type MailKey } from '../_shared/notify.ts'
import { utcToSalonWall } from '../_shared/salon.ts'

const KEYS = new Set<MailKey>(MAIL_KEYS)

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
  if (!id) return json(req, 400, { ok: false, error: 'invalid' })
  const draft = {
    subject: typeof record.subject === 'string' ? record.subject : undefined,
    body: typeof record.body === 'string' ? record.body : undefined,
  }
  // Without a template Bjorn writes the whole mail himself, so both parts must be there.
  const free = !isKey(record.key)
  if (free && (!draft.subject?.trim() || !draft.body?.trim())) return json(req, 400, { ok: false, error: 'invalid' })

  const db = serviceClient()
  const found = await db.from('bookings').select('id, service, name, email, start, lang, status, kind').eq('id', id).maybeSingle()
  if (found.error) throw new Error(found.error.message)
  if (!found.data) return json(req, 404, { ok: false, error: 'missing' })
  const row = found.data as { id: string; service: string; name: string; email: string; start: string; lang: string; status: string; kind: string }
  // A free mail still gets the button that fits the booking: move it, or pick again after a refusal.
  const key: MailKey = isKey(record.key) ? record.key : templateFor(row)
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
    key,
    draft,
  )
  if (!result.sent) return json(req, 200, { ok: false, sent: false, error: 'unsent' })
  return json(req, 200, { ok: true, sent: true })
})
