import type { DayHours, Weekday } from '../../../src/schedule.ts'
import { serviceClient } from '../_shared/db.ts'
import { json, readJson, rejectUnlessSession, servePost } from '../_shared/http.ts'

const WEEKDAYS: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const SERVICES = new Set(['cut', 'beard', 'both'])
const TEMPLATE_KEYS = new Set(['thanks', 'accepted', 'declined'])
const LANGS = new Set(['nl', 'en'])
const CLOCK = /^\d{2}:\d{2}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

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
    const deleted = time
      ? await db.from('schedule_blocks').delete().eq('date', date).eq('time', time)
      : await db.from('schedule_blocks').delete().eq('date', date).is('time', null)
    if (deleted.error) throw new Error(deleted.error.message)
    if (record.on) {
      const inserted = await db.from('schedule_blocks').insert({ date, time })
      if (inserted.error) throw new Error(inserted.error.message)
    }
    return json(req, 200, { ok: true })
  }

  if (record.type === 'services') {
    if (!Array.isArray(record.services)) return json(req, 400, { ok: false, error: 'invalid' })
    const rows = []
    for (const item of record.services) {
      if (!item || typeof item !== 'object') return json(req, 400, { ok: false, error: 'invalid' })
      const service = item as { id?: unknown; price?: unknown; minutes?: unknown }
      if (typeof service.id !== 'string' || !SERVICES.has(service.id)) return json(req, 400, { ok: false, error: 'invalid' })
      if (typeof service.price !== 'string' || !service.price.trim()) return json(req, 400, { ok: false, error: 'invalid' })
      if (typeof service.minutes !== 'number' || !Number.isInteger(service.minutes) || service.minutes <= 0 || service.minutes > 480) {
        return json(req, 400, { ok: false, error: 'invalid' })
      }
      rows.push({ id: service.id, price: service.price.trim(), minutes: service.minutes })
    }
    if (rows.length > 0) {
      const saved = await db.from('services').upsert(rows)
      if (saved.error) throw new Error(saved.error.message)
    }
    return json(req, 200, { ok: true })
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
