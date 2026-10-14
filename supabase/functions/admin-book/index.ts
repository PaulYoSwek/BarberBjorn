import { insertBooking, rememberClient, servicePrice } from '../_shared/clients.ts'
import { serviceClient } from '../_shared/db.ts'
import { confirmedOverlaps, lostOverlapRace } from '../_shared/holds.ts'
import { json, readJson, rejectUnlessSession, servePost } from '../_shared/http.ts'
import { sendBookingMail } from '../_shared/notify.ts'
import { salonNow, salonWallToUtc } from '../_shared/salon.ts'
import { loadSchedule, serviceMinutes } from '../_shared/schedule.ts'

const WALL = /^\d{4}-\d{2}-\d{2}T\d{2}:(00|15|30|45):00$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Service = 'cut' | 'beard' | 'both'

function isService(value: unknown): value is Service {
  return value === 'cut' || value === 'beard' || value === 'both'
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function wallOf(date: Date): string {
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
}

/**
 * Bjorn plans an appointment himself from the dashboard. It is confirmed at once.
 * Closed times and opening hours are his to overrule; another booking is not.
 */
servePost(async (req) => {
  const denied = await rejectUnlessSession(req)
  if (denied) return denied
  const body = await readJson(req)
  if (!body || typeof body !== 'object') return json(req, 400, { ok: false, error: 'invalid' })
  const record = body as Record<string, unknown>
  const service = record.service
  const start = typeof record.start === 'string' ? record.start : ''
  const name = text(record.name, 80)
  const email = text(record.email, 160)
  const phone = text(record.phone, 40)
  const mail = record.mail === true
  if (!isService(service) || !WALL.test(start) || !name) return json(req, 400, { ok: false, error: 'invalid' })
  if (email && !EMAIL.test(email)) return json(req, 400, { ok: false, error: 'email' })
  if (start <= wallOf(salonNow())) return json(req, 400, { ok: false, error: 'past' })

  const db = serviceClient()
  const schedule = await loadSchedule(db)
  const minutes = serviceMinutes(schedule, service)
  if ((await confirmedOverlaps(db, '', start, minutes)).length > 0) {
    return json(req, 409, { ok: false, error: 'overlap' })
  }

  const inserted = await insertBooking(db, {
    service,
    price: await servicePrice(db, service),
    name,
    email,
    phone,
    start: salonWallToUtc(start),
    minutes,
    kind: 'slot',
    status: 'confirmed',
    lang: 'nl',
    mail_sent: false,
  })
  if (inserted.error || !inserted.data) {
    const error = inserted.error as { code?: string; message?: string } | null
    if (error && (error.code === '23505' || error.code === '23P01' || /overlap|exclusion/i.test(error.message ?? ''))) {
      return json(req, 409, { ok: false, error: 'overlap' })
    }
    throw new Error(error?.message ?? 'insert')
  }
  const row = inserted.data as { id: string; created_at: string }

  // Someone may have booked the same time on the site a moment ago: the first one keeps it.
  const overlaps = await confirmedOverlaps(db, row.id, start, minutes)
  if (overlaps.some((other) => lostOverlapRace(row, other))) {
    const removed = await db.from('bookings').delete().eq('id', row.id)
    if (removed.error) throw new Error(removed.error.message)
    return json(req, 409, { ok: false, error: 'overlap' })
  }

  await rememberClient(db, { name, email, phone })
  let sent = false
  if (mail && email) {
    try {
      sent = (await sendBookingMail(db, { id: row.id, email, name, service, start, lang: 'nl' }, 'accepted')).sent
    } catch {
      sent = false
    }
  }
  return json(req, 200, { ok: true, id: row.id, sent })
})
