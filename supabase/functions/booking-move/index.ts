import { serviceClient } from '../_shared/db.ts'
import { confirmedOverlaps } from '../_shared/holds.ts'
import { json, readJson, rejectUnlessSession, servePost } from '../_shared/http.ts'
import { sendBookingMail } from '../_shared/notify.ts'
import { salonNow, salonWallToUtc, utcToSalonWall } from '../_shared/salon.ts'

const WALL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00$/

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

function wallOf(date: Date): string {
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
}

/** Bjorn moves a booking to another moment: it becomes confirmed there and the client is mailed. */
servePost(async (req) => {
  const denied = await rejectUnlessSession(req)
  if (denied) return denied
  const body = await readJson(req)
  if (!body || typeof body !== 'object') return json(req, 400, { ok: false, error: 'invalid' })
  const record = body as { id?: unknown; start?: unknown }
  const id = typeof record.id === 'string' ? record.id : ''
  const start = typeof record.start === 'string' ? record.start : ''
  if (!id || !WALL.test(start)) return json(req, 400, { ok: false, error: 'invalid' })
  if (start <= wallOf(salonNow())) return json(req, 400, { ok: false, error: 'past' })

  const db = serviceClient()
  const found = await db
    .from('bookings')
    .select('id, service, name, email, start, minutes, status, lang')
    .eq('id', id)
    .maybeSingle()
  if (found.error) throw new Error(found.error.message)
  if (!found.data) return json(req, 404, { ok: false, error: 'missing' })
  const row = found.data as BookingRecord

  const overlaps = await confirmedOverlaps(db, row.id, start, row.minutes)
  if (overlaps.length > 0) return json(req, 409, { ok: false, error: 'overlap' })

  const before = { start: row.start, status: row.status }
  const updated = await db
    .from('bookings')
    .update({ start: salonWallToUtc(start), status: 'confirmed' })
    .eq('id', id)
  if (updated.error) throw new Error(updated.error.message)

  // Someone may have booked the same time a moment ago: the first confirmed booking keeps it.
  const raced = await confirmedOverlaps(db, row.id, start, row.minutes)
  if (raced.length > 0) {
    const reverted = await db.from('bookings').update(before).eq('id', id)
    if (reverted.error) throw new Error(reverted.error.message)
    return json(req, 409, { ok: false, error: 'overlap' })
  }

  let sent = false
  try {
    sent = (
      await sendBookingMail(
        db,
        { id: row.id, email: row.email, name: row.name, service: row.service, start, lang: row.lang },
        'moved',
      )
    ).sent
  } catch {
    sent = false
  }
  return json(req, 200, { ok: true, sent, start, previous: utcToSalonWall(String(before.start)) })
})
