import { todayIso, validateBooking } from '../../../src/booking.ts'
import { copy } from '../../../src/content.ts'
import { insertBooking, rememberClient, servicePrice } from '../_shared/clients.ts'
import { serviceClient } from '../_shared/db.ts'
import { json, readJson, servePost } from '../_shared/http.ts'
import { parseBooking, validationMessage } from '../_shared/input.ts'
import { notifyBjorn, sendBookingMail } from '../_shared/notify.ts'
import { salonNow, salonWallToUtc } from '../_shared/salon.ts'
import { loadSchedule, offersService, serviceMinutes } from '../_shared/schedule.ts'

servePost(async (req) => {
  const input = parseBooking(await readJson(req), 'custom')
  if (!input) return json(req, 400, { ok: false, error: 'invalid' })
  const db = serviceClient()
  const now = salonNow()
  const schedule = await loadSchedule(db)
  const checked = validateBooking(input, copy[input.lang], todayIso(now), now, schedule)
  if (!checked.ok) return json(req, 400, { ok: false, error: validationMessage(checked.errors, input.lang) })
  if (!offersService(schedule, input.service)) return json(req, 400, { ok: false, error: copy[input.lang].fieldError })
  const inserted = await insertBooking(db, {
    service: input.service,
    price: await servicePrice(db, input.service),
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
  if (inserted.error || !inserted.data) throw new Error(inserted.error?.message ?? 'insert')
  await rememberClient(db, input)
  const person = { name: input.name.trim(), email: input.email.trim(), phone: input.phone.trim() }
  let sent = false
  try {
    const row = inserted.data as { id: string }
    sent = (
      await sendBookingMail(
        db,
        { id: row.id, ...person, service: input.service, start: input.slot, lang: input.lang },
        'received',
      )
    ).sent
  } catch {
    sent = false
  }
  await notifyBjorn(db, { ...person, service: input.service, start: input.slot, minutes: serviceMinutes(schedule, input.service) }, 'request')
  return json(req, 200, { ok: true, sent })
})
