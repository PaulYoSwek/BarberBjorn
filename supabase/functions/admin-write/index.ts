import { isBlockColor, REASON_MAX } from '../../../src/block-colors.ts'
import { MAIL_KEYS } from '../../../src/mail-templates.ts'
import { addDaysIso, weeklyBlockRows, type BlockPattern } from '../../../src/planning.ts'
import type { DayHours, Weekday } from '../../../src/schedule.ts'
import { isSchemaMissing } from '../_shared/clients.ts'
import { confirmedOverlaps } from '../_shared/holds.ts'
import { utcToSalonWall } from '../_shared/salon.ts'
import { serviceClient } from '../_shared/db.ts'
import { json, readJson, rejectUnlessSession, servePost } from '../_shared/http.ts'

const WEEKDAYS: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const SERVICE_ID = /^[a-z0-9-]{1,40}$/
const TEMPLATE_KEYS = new Set<string>(MAIL_KEYS)
const LANGS = new Set(['nl', 'en'])
const CLOCK = /^\d{2}:\d{2}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

/** "27,50" / "€ 20" / "35" → "€27,50" / "€20" / "€35"; text without digits stays as typed. */
function euroPrice(text: string): string {
  const cleaned = text.replace(/[^\d,.]/g, '').replace(',', '.')
  const value = Number(cleaned)
  if (!cleaned || !Number.isFinite(value)) return text
  const cents = Math.round(value * 100)
  return cents % 100 === 0 ? `€${cents / 100}` : `€${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')}`
}

/** Bjorn's note on a closed time. Returns null when the body is malformed. */
function parseNote(value: Record<string, unknown>): { reason: string; color: string } | null {
  const reason = value.reason === undefined ? '' : value.reason
  const color = value.color === undefined ? '' : value.color
  if (typeof reason !== 'string' || reason.length > REASON_MAX) return null
  if (!isBlockColor(color)) return null
  return { reason: reason.trim(), color }
}

function parseHours(value: unknown): DayHours | null {
  if (!value || typeof value !== 'object') return null
  const hours = value as { closed?: unknown; open?: unknown; close?: unknown }
  if (hours.closed === true) return { closed: true }
  if (typeof hours.open === 'string' && typeof hours.close === 'string' && CLOCK.test(hours.open) && CLOCK.test(hours.close)) {
    return { open: hours.open, close: hours.close }
  }
  return null
}

servePost(async (req) => {
  const denied = await rejectUnlessSession(req)
  if (denied) return denied
  const body = await readJson(req)
  if (!body || typeof body !== 'object') return json(req, 400, { ok: false, error: 'invalid' })
  const record = body as Record<string, unknown>
  const db = serviceClient()

  if (record.type === 'week') {
    if (!record.week || typeof record.week !== 'object') return json(req, 400, { ok: false, error: 'invalid' })
    const week = record.week as Record<string, unknown>
    const rows = []
    for (const weekday of WEEKDAYS) {
      const hours = parseHours(week[weekday])
      if (!hours) return json(req, 400, { ok: false, error: 'invalid' })
      rows.push(
        'closed' in hours
          ? { weekday, closed: true, open: null, close: null }
          : { weekday, closed: false, open: hours.open, close: hours.close },
      )
    }
    const saved = await db.from('schedule_week').upsert(rows)
    if (saved.error) throw new Error(saved.error.message)
    // The viewed week became the template, so its one-off hours are no longer needed.
    const clear = Array.isArray(record.clearDates)
      ? record.clearDates.filter((item): item is string => typeof item === 'string' && DATE.test(item))
      : []
    if (clear.length > 0) {
      const cleared = await db.from('schedule_exceptions').delete().in('date', clear)
      if (cleared.error) throw new Error(cleared.error.message)
    }
    return json(req, 200, { ok: true })
  }

  if (record.type === 'client') {
    const id = typeof record.id === 'string' ? record.id : ''
    const name = typeof record.name === 'string' ? record.name.trim() : ''
    const email = typeof record.email === 'string' ? record.email.trim().toLowerCase() : ''
    const phone = typeof record.phone === 'string' ? record.phone.trim() : ''
    const note = typeof record.note === 'string' ? record.note.trim() : ''
    if (name.length < 2 || name.length > 120) return json(req, 400, { ok: false, error: 'name' })
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(req, 400, { ok: false, error: 'email' })
    if (phone.length > 40 || note.length > 2000) return json(req, 400, { ok: false, error: 'invalid' })
    const fields = { name, email, phone, note }
    let targetId = id
    if (!targetId && email) {
      const existing = await db.from('clients').select('id').eq('email', email).maybeSingle()
      if (existing.error) throw new Error(existing.error.message)
      targetId = (existing.data as { id: string } | null)?.id ?? ''
    }
    const saved = targetId
      ? await db.from('clients').update(fields).eq('id', targetId).select('id').single()
      : await db.from('clients').insert(fields).select('id').single()
    if (saved.error) {
      if (saved.error.code === '23505') return json(req, 409, { ok: false, error: 'exists' })
      throw new Error(saved.error.message)
    }
    return json(req, 200, { ok: true, id: (saved.data as { id: string }).id })
  }

  if (record.type === 'product') {
    const id = typeof record.id === 'string' ? record.id : ''
    const name = typeof record.name === 'string' ? record.name.trim() : ''
    const price = typeof record.price === 'number' && Number.isFinite(record.price) ? Math.round(record.price * 100) / 100 : NaN
    const stock = typeof record.stock === 'number' && Number.isInteger(record.stock) ? record.stock : NaN
    const active = record.active === undefined ? true : record.active === true
    if (name.length < 1 || name.length > 80) return json(req, 400, { ok: false, error: 'name' })
    if (!Number.isFinite(price) || price < 0 || price > 10_000) return json(req, 400, { ok: false, error: 'price' })
    if (!Number.isFinite(stock) || stock < -1000 || stock > 100_000) return json(req, 400, { ok: false, error: 'stock' })
    const fields = { name, price, stock, active }
    const saved = id
      ? await db.from('products').update(fields).eq('id', id).select('id').single()
      : await db.from('products').insert(fields).select('id').single()
    if (saved.error) throw new Error(saved.error.message)
    return json(req, 200, { ok: true, id: (saved.data as { id: string }).id })
  }

  if (record.type === 'bookingService') {
    // Bjorn swaps the service on an appointment; the new length may not run into another one.
    const id = typeof record.id === 'string' ? record.id : ''
    const service = typeof record.service === 'string' ? record.service : ''
    if (!id || !SERVICE_ID.test(service)) return json(req, 400, { ok: false, error: 'invalid' })
    const found = await db.from('bookings').select('id, start, status').eq('id', id).maybeSingle()
    if (found.error) throw new Error(found.error.message)
    if (!found.data) return json(req, 404, { ok: false, error: 'missing' })
    const booking = found.data as { id: string; start: string; status: string }
    const offer = await db.from('services').select('minutes, price, active').eq('id', service).maybeSingle()
    if (offer.error) throw new Error(offer.error.message)
    const info = offer.data as { minutes?: number; price?: string; active?: boolean } | null
    if (!info || info.active === false || typeof info.minutes !== 'number') return json(req, 400, { ok: false, error: 'service' })
    if (booking.status === 'confirmed') {
      const overlaps = await confirmedOverlaps(db, id, utcToSalonWall(String(booking.start)), info.minutes)
      if (overlaps.length > 0) return json(req, 409, { ok: false, error: 'overlap' })
    }
    // The discount was for the old service; the new list price applies.
    const updated = await db
      .from('bookings')
      .update({ service, minutes: info.minutes, price: info.price ?? null, charged: null })
      .eq('id', id)
    if (updated.error) {
      const error = updated.error as { code?: string; message?: string }
      if (error.code === '23P01' || /overlap|exclusion/i.test(error.message ?? '')) {
        return json(req, 409, { ok: false, error: 'overlap' })
      }
      throw new Error(error.message)
    }
    return json(req, 200, { ok: true, minutes: info.minutes, price: info.price ?? null })
  }

  if (record.type === 'bookingPaid') {
    // Paid is what makes an appointment revenue. Only a confirmed one can be paid.
    const id = typeof record.id === 'string' ? record.id : ''
    if (!id || typeof record.paid !== 'boolean') return json(req, 400, { ok: false, error: 'invalid' })
    const found = await db.from('bookings').select('id, status').eq('id', id).maybeSingle()
    if (found.error) throw new Error(found.error.message)
    if (!found.data) return json(req, 404, { ok: false, error: 'missing' })
    if ((found.data as { status: string }).status !== 'confirmed') return json(req, 409, { ok: false, error: 'status' })
    const updated = await db.from('bookings').update({ paid_at: record.paid ? new Date().toISOString() : null }).eq('id', id)
    if (updated.error) {
      if (isSchemaMissing(updated.error)) return json(req, 503, { ok: false, error: 'schema' })
      throw new Error(updated.error.message)
    }
    return json(req, 200, { ok: true })
  }

  if (record.type === 'bookingDelete') {
    // Products sold with it go too (on delete cascade); the client record stays.
    const id = typeof record.id === 'string' ? record.id : ''
    if (!id) return json(req, 400, { ok: false, error: 'invalid' })
    const removed = await db.from('bookings').delete().eq('id', id).select('id')
    if (removed.error) throw new Error(removed.error.message)
    if (!removed.data || removed.data.length === 0) return json(req, 404, { ok: false, error: 'missing' })
    return json(req, 200, { ok: true })
  }

  if (record.type === 'clientDelete') {
    const id = typeof record.id === 'string' ? record.id : ''
    const email = typeof record.email === 'string' ? record.email.trim().toLowerCase() : ''
    const phone = typeof record.phone === 'string' ? record.phone.trim() : ''
    if (!id && !email && !phone) return json(req, 400, { ok: false, error: 'invalid' })
    // Mail addresses may contain _ or %, which ilike would read as wildcards.
    const pattern = email.replace(/[\\%_]/g, (char) => `\\${char}`)
    const bookings = email
      ? await db.from('bookings').delete().ilike('email', pattern).select('id')
      : await db.from('bookings').delete().eq('phone', phone).eq('email', '').select('id')
    if (bookings.error) throw new Error(bookings.error.message)
    if (id) {
      const removed = await db.from('clients').delete().eq('id', id)
      if (removed.error) throw new Error(removed.error.message)
    } else if (email) {
      const removed = await db.from('clients').delete().eq('email', email)
      if (removed.error && !isSchemaMissing(removed.error)) throw new Error(removed.error.message)
    }
    return json(req, 200, { ok: true, bookings: bookings.data?.length ?? 0 })
  }

  if (record.type === 'copyBlocks') {
    const from = typeof record.from === 'string' ? record.from.slice(0, 10) : ''
    const weeks = typeof record.weeks === 'number' && Number.isInteger(record.weeks) ? record.weeks : 0
    if (!DATE.test(from) || weeks < 1 || weeks > 110) return json(req, 400, { ok: false, error: 'invalid' })
    if (!record.pattern || typeof record.pattern !== 'object') return json(req, 400, { ok: false, error: 'invalid' })
    const given = record.pattern as Record<string, unknown>
    const pattern: Partial<Record<Weekday, BlockPattern[]>> = {}
    for (const weekday of WEEKDAYS) {
      const entries = given[weekday]
      if (entries === undefined) continue
      if (!Array.isArray(entries)) return json(req, 400, { ok: false, error: 'invalid' })
      const seen = new Set<string>()
      const parsed: BlockPattern[] = []
      for (const entry of entries) {
        // Older dashboards send plain times; current ones send { time, reason, color }.
        const item = typeof entry === 'string' ? { time: entry } : (entry as Record<string, unknown> | null)
        if (!item || typeof item.time !== 'string' || !CLOCK.test(item.time)) {
          return json(req, 400, { ok: false, error: 'invalid' })
        }
        const note = parseNote(item)
        if (!note || seen.has(item.time)) {
          if (!note) return json(req, 400, { ok: false, error: 'invalid' })
          continue
        }
        seen.add(item.time)
        parsed.push({ time: item.time, ...note })
      }
      pattern[weekday] = parsed
    }
    const to = addDaysIso(from, weeks * 7 - 1)
    // Replace closed half-hours on the later dates; whole closed days (holidays) stay.
    const cleared = await db
      .from('schedule_blocks')
      .delete()
      .gte('date', from)
      .lte('date', to)
      .not('time', 'is', null)
    if (cleared.error) throw new Error(cleared.error.message)
    const rows = weeklyBlockRows(from, weeks, pattern)
    for (let start = 0; start < rows.length; start += 500) {
      const inserted = await db.from('schedule_blocks').insert(rows.slice(start, start + 500))
      if (inserted.error) throw new Error(inserted.error.message)
    }
    return json(req, 200, { ok: true, copied: rows.length })
  }

  if (record.type === 'exception') {
    const date = typeof record.date === 'string' ? record.date.slice(0, 10) : ''
    if (!DATE.test(date)) return json(req, 400, { ok: false, error: 'invalid' })
    if (record.hours === null) {
      const deleted = await db.from('schedule_exceptions').delete().eq('date', date)
      if (deleted.error) throw new Error(deleted.error.message)
      return json(req, 200, { ok: true })
    }
    const hours = parseHours(record.hours)
    if (!hours) return json(req, 400, { ok: false, error: 'invalid' })
    const saved = await db.from('schedule_exceptions').upsert(
      'closed' in hours
        ? { date, closed: true, open: null, close: null }
        : { date, closed: false, open: hours.open, close: hours.close },
    )
    if (saved.error) throw new Error(saved.error.message)
    return json(req, 200, { ok: true })
  }

  if (record.type === 'blocks') {
    const date = typeof record.date === 'string' ? record.date.slice(0, 10) : ''
    if (!DATE.test(date) || typeof record.on !== 'boolean') return json(req, 400, { ok: false, error: 'invalid' })
    const time = typeof record.time === 'string' && record.time ? record.time.slice(0, 5) : null
    if (time && !CLOCK.test(time)) return json(req, 400, { ok: false, error: 'invalid' })
    const note = parseNote(record)
    if (!note) return json(req, 400, { ok: false, error: 'invalid' })
    const deleted = time
      ? await db.from('schedule_blocks').delete().eq('date', date).eq('time', time)
      : await db.from('schedule_blocks').delete().eq('date', date).is('time', null)
    if (deleted.error) throw new Error(deleted.error.message)
    if (record.on) {
      const inserted = await db.from('schedule_blocks').insert({ date, time, ...note })
      if (inserted.error) throw new Error(inserted.error.message)
    }
    return json(req, 200, { ok: true })
  }

  if (record.type === 'services') {
    if (!Array.isArray(record.services)) return json(req, 400, { ok: false, error: 'invalid' })
    const rows = []
    for (const item of record.services) {
      if (!item || typeof item !== 'object') return json(req, 400, { ok: false, error: 'invalid' })
      const service = item as Record<string, unknown> & { id?: unknown; price?: unknown; minutes?: unknown }
      if (typeof service.id !== 'string' || !SERVICE_ID.test(service.id)) return json(req, 400, { ok: false, error: 'invalid' })
      if (typeof service.price !== 'string' || !service.price.trim()) return json(req, 400, { ok: false, error: 'invalid' })
      if (typeof service.minutes !== 'number' || !Number.isInteger(service.minutes) || service.minutes <= 0 || service.minutes > 480) {
        return json(req, 400, { ok: false, error: 'invalid' })
      }
      // The agenda runs in quarter-hours, so every length must be a whole number of them.
      if (service.minutes % 15 !== 0) return json(req, 400, { ok: false, error: 'minutes' })
      const row: Record<string, unknown> = { id: service.id, price: euroPrice(service.price.trim()), minutes: service.minutes }
      // Names, description, order and visibility are optional, so an older dashboard still saves prices.
      for (const [key, max] of [['name_nl', 60], ['name_en', 60], ['detail_nl', 120], ['detail_en', 120]] as const) {
        if (service[key] === undefined) continue
        if (typeof service[key] !== 'string') return json(req, 400, { ok: false, error: 'invalid' })
        row[key] = (service[key] as string).trim().slice(0, max)
      }
      if (service.name_nl !== undefined && !row.name_nl) return json(req, 400, { ok: false, error: 'name' })
      if (service.sort !== undefined) {
        if (typeof service.sort !== 'number' || !Number.isInteger(service.sort)) return json(req, 400, { ok: false, error: 'invalid' })
        row.sort = service.sort
      }
      if (service.active !== undefined) {
        if (typeof service.active !== 'boolean') return json(req, 400, { ok: false, error: 'invalid' })
        row.active = service.active
      }
      rows.push(row)
    }
    if (rows.length > 0) {
      const saved = await db.from('services').upsert(rows)
      if (saved.error) throw new Error(saved.error.message)
    }
    return json(req, 200, { ok: true })
  }

  if (record.type === 'serviceDelete') {
    const id = typeof record.id === 'string' ? record.id : ''
    if (!SERVICE_ID.test(id)) return json(req, 400, { ok: false, error: 'invalid' })
    // A service on appointments keeps its row (hidden), so those appointments keep their name and price.
    const used = await db.from('bookings').select('id', { count: 'exact', head: true }).eq('service', id)
    if (used.error) throw new Error(used.error.message)
    if ((used.count ?? 0) > 0) {
      const hidden = await db.from('services').update({ active: false }).eq('id', id)
      if (hidden.error) throw new Error(hidden.error.message)
      return json(req, 200, { ok: true, hidden: true })
    }
    const removed = await db.from('services').delete().eq('id', id)
    if (removed.error) throw new Error(removed.error.message)
    return json(req, 200, { ok: true, hidden: false })
  }

  if (record.type === 'templates') {
    if (!Array.isArray(record.templates)) return json(req, 400, { ok: false, error: 'invalid' })
    const rows = []
    for (const item of record.templates) {
      if (!item || typeof item !== 'object') return json(req, 400, { ok: false, error: 'invalid' })
      const template = item as { key?: unknown; lang?: unknown; subject?: unknown; body?: unknown }
      if (typeof template.key !== 'string' || !TEMPLATE_KEYS.has(template.key)) return json(req, 400, { ok: false, error: 'invalid' })
      if (typeof template.lang !== 'string' || !LANGS.has(template.lang)) return json(req, 400, { ok: false, error: 'invalid' })
      if (typeof template.subject !== 'string' || typeof template.body !== 'string') return json(req, 400, { ok: false, error: 'invalid' })
      rows.push({ key: template.key, lang: template.lang, subject: template.subject, body: template.body })
    }
    if (rows.length > 0) {
      const saved = await db.from('mail_templates').upsert(rows)
      if (saved.error) throw new Error(saved.error.message)
    }
    return json(req, 200, { ok: true })
  }

  return json(req, 400, { ok: false, error: 'invalid' })
})
