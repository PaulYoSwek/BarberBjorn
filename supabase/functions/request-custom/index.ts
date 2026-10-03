import { todayIso, validateBooking } from '../../../src/booking.ts'
import { copy, type ServiceId } from '../../../src/content.ts'
import { serviceClient } from '../_shared/db.ts'
import { json, readJson, servePost } from '../_shared/http.ts'
import { parseBooking, validationMessage } from '../_shared/input.ts'
import { salonNow, salonWallToUtc } from '../_shared/salon.ts'
import { loadSchedule, serviceMinutes } from '../_shared/schedule.ts'

function isService(value: string): value is ServiceId {
  return value === 'cut' || value === 'beard' || value === 'both'
}

servePost(async (req) => {
  const input = parseBooking(await readJson(req), 'custom')
  if (!input) return json(req, 400, { ok: false, error: 'invalid' })
  const db = serviceClient()
  const now = salonNow()
  const schedule = await loadSchedule(db)
  const checked = validateBooking(input, copy[input.lang], todayIso(now), now, schedule)
  if (!checked.ok) return json(req, 400, { ok: false, error: validationMessage(checked.errors, input.lang) })
  if (!isService(input.service)) return json(req, 400, { ok: false, error: copy[input.lang].fieldError })
  const inserted = await db.from('bookings').insert({
    service: input.service,
    name: input.name.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    start: salonWallToUtc(input.slot),
    minutes: serviceMinutes(schedule, input.service),
    kind: 'custom',
    status: 'pending',
    lang: input.lang,
    mail_sent: false,
  })
  if (inserted.error) throw new Error(inserted.error.message)
  return json(req, 200, { ok: true })
})
