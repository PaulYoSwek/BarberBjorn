import { todayIso, validateBooking } from '../../../src/booking.ts'
import { copy, type ServiceId } from '../../../src/content.ts'
import { isFree } from '../../../src/planning.ts'
import { insertBooking, rememberClient, servicePrice } from '../_shared/clients.ts'
import { serviceClient } from '../_shared/db.ts'
import { confirmedOverlaps, lostOverlapRace } from '../_shared/holds.ts'
import { json, readJson, servePost } from '../_shared/http.ts'
import { parseBooking, takenMessage, validationMessage } from '../_shared/input.ts'
import { sendBookingMail } from '../_shared/notify.ts'
import { salonNow, salonWallToUtc } from '../_shared/salon.ts'
import { loadSchedule, serviceMinutes } from '../_shared/schedule.ts'

function isService(value: string): value is ServiceId {
  return value === 'cut' || value === 'beard' || value === 'both'
}

function isOverlapError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === '23505' || error.code === '23P01' || /overlap|exclusion/i.test(error.message ?? '')
}

servePost(async (req) => {
  const input = parseBooking(await readJson(req), 'slot')
  if (!input) return json(req, 400, { ok: false, error: 'invalid' })
  const db = serviceClient()
  const now = salonNow()
  const schedule = await loadSchedule(db)
  const checked = validateBooking(input, copy[input.lang], todayIso(now), now, schedule)
  if (!checked.ok) {
    const message = validationMessage(checked.errors, input.lang)
    const status = message === takenMessage(input.lang) ? 409 : 400
    return json(req, status, { ok: false, error: message })
  }
  if (!isService(input.service)) return json(req, 400, { ok: false, error: copy[input.lang].fieldError })
  const minutes = serviceMinutes(schedule, input.service)
  if (!isFree(input.slot, minutes, schedule, now)) {
    return json(req, 409, { ok: false, error: takenMessage(input.lang) })
  }
  const inserted = await insertBooking(db, {
    service: input.service,
    price: await servicePrice(db, input.service),
    name: input.name.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    start: salonWallToUtc(input.slot),
    minutes,
    kind: 'slot',
    status: 'confirmed',
    lang: input.lang,
    mail_sent: false,
  })
  if (inserted.error || !inserted.data) {
    if (isOverlapError(inserted.error)) return json(req, 409, { ok: false, error: takenMessage(input.lang) })
    throw new Error(inserted.error?.message ?? 'insert')
  }
  const row = inserted.data as { id: string; created_at: string }
  const overlaps = await confirmedOverlaps(db, row.id, input.slot, minutes)
  if (overlaps.some((other) => lostOverlapRace(row, other))) {
    const removed = await db.from('bookings').delete().eq('id', row.id)
    if (removed.error) throw new Error(removed.error.message)
    return json(req, 409, { ok: false, error: takenMessage(input.lang) })
  }
  await rememberClient(db, input)
  let sent = false
  try {
    sent = (
      await sendBookingMail(
        db,
        {
          id: row.id,
          email: input.email.trim(),
          name: input.name.trim(),
          service: input.service,
          start: input.slot,
          lang: input.lang,
        },
        'thanks',
      )
    ).sent
  } catch {
    sent = false
  }
  return json(req, 200, { ok: true, sent })
})
