import { applyDecision } from '../../../src/planning.ts'
import { serviceClient } from '../_shared/db.ts'
import { confirmedOverlaps } from '../_shared/holds.ts'
import { json, readJson, rejectUnlessSession, servePost } from '../_shared/http.ts'
import { sendBookingMail, type MailKey } from '../_shared/notify.ts'
import { salonNow, utcToSalonWall } from '../_shared/salon.ts'
import { loadSchedule } from '../_shared/schedule.ts'

type BookingRecord = {
  id: string
  service: string
  name: string
  email: string
  start: string
  minutes: number
  status: string
  lang: string
}

servePost(async (req) => {
  const denied = await rejectUnlessSession(req)
  if (denied) return denied
  const body = await readJson(req)
  if (!body || typeof body !== 'object') return json(req, 400, { ok: false, error: 'invalid' })
  const record = body as { id?: unknown; action?: unknown }
  const id = typeof record.id === 'string' ? record.id : ''
  const action = record.action === 'accept' || record.action === 'decline' ? record.action : null
  if (!id || !action) return json(req, 400, { ok: false, error: 'invalid' })

  const db = serviceClient()
  const found = await db
    .from('bookings')
    .select('id, service, name, email, start, minutes, status, lang')
    .eq('id', id)
    .maybeSingle()
  if (found.error) throw new Error(found.error.message)
  if (!found.data) return json(req, 404, { ok: false, error: 'missing' })
  const row = found.data as BookingRecord
  const wall = utcToSalonWall(String(row.start))
  const schedule = await loadSchedule(db, row.id)
  const decision = applyDecision(
    { start: wall, minutes: row.minutes, status: row.status },
    action,
    schedule,
    salonNow(),
  )
  if ('error' in decision) return json(req, 409, { ok: false, error: decision.error })

  const updated = await db.from('bookings').update({ status: decision.status }).eq('id', id)
  if (updated.error) throw new Error(updated.error.message)
  if (decision.status === 'confirmed') {
    const overlaps = await confirmedOverlaps(db, row.id, wall, row.minutes)
    if (overlaps.length > 0) {
      const reverted = await db.from('bookings').update({ status: row.status }).eq('id', id)
      if (reverted.error) throw new Error(reverted.error.message)
      return json(req, 409, { ok: false, error: 'overlap' })
    }
  }

  const key: MailKey = action === 'accept' ? 'accepted' : 'declined'
  let sent = false
  try {
    sent = (
      await sendBookingMail(
        db,
        {
          id: row.id,
          email: row.email,
          name: row.name,
          service: row.service,
          start: wall,
          lang: row.lang,
        },
        key,
      )
    ).sent
  } catch {
    sent = false
  }
  return json(req, 200, { ok: true, sent })
})
