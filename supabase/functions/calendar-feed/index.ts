import { calendarFeed, type FeedBooking } from '../../../src/calendar-feed.ts'
import { CONTACT, SITE_URL } from '../../../src/content.ts'
import { isSchemaMissing } from '../_shared/clients.ts'
import { serviceClient } from '../_shared/db.ts'
import { corsHeaders, json } from '../_shared/http.ts'
import { calendarToken, safeEqual, validSession } from '../_shared/session.ts'

const CALENDAR_NAME = 'Bjorn’s Barber afspraken'
/** Appointments this far back stay in the calendar, so last weeks are still there to look up. */
const DAYS_BACK = 120

type Row = {
  id: string
  name: string
  email: string | null
  phone: string | null
  service: string
  start: string
  minutes: number | null
  price: string | null
  paid_at?: string | null
}

/** The link calendar apps subscribe to: the site's own route, which passes requests on to this function. */
async function feedUrl(): Promise<string> {
  return `${SITE_URL}/api/agenda?token=${await calendarToken()}`
}

async function bookings(): Promise<FeedBooking[]> {
  const db = serviceClient()
  const since = new Date(Date.now() - DAYS_BACK * 24 * 60 * 60 * 1000).toISOString()
  const columns = 'id, name, email, phone, service, start, minutes, price'
  const list = (extra: string) =>
    db
      .from('bookings')
      .select(extra ? `${columns}, ${extra}` : columns)
      .eq('status', 'confirmed')
      .gte('start', since)
      .order('start')
  let listed = await list('paid_at')
  if (listed.error && isSchemaMissing(listed.error)) listed = await list('')
  if (listed.error) throw new Error(listed.error.message)
  const rows = (listed.data ?? []) as Row[]

  const named = await db.from('services').select('id, name_nl')
  const names = new Map<string, string>()
  for (const item of (named.data ?? []) as { id: string; name_nl: string | null }[]) {
    if (item.name_nl) names.set(item.id, item.name_nl)
  }

  return rows.map((row) => ({
    id: String(row.id),
    name: row.name,
    email: row.email ?? '',
    phone: row.phone ?? '',
    service: names.get(row.service) ?? row.service,
    start: new Date(String(row.start)).toISOString(),
    minutes: typeof row.minutes === 'number' && row.minutes > 0 ? row.minutes : 30,
    price: row.price,
    ...(row.paid_at === undefined ? {} : { paid: Boolean(row.paid_at) }),
  }))
}

/**
 * GET with the secret token: the appointments as an iCalendar feed that Google
 * Calendar, Outlook and Apple Calendar subscribe to.
 * POST from the dashboard (signed in): the feed link to subscribe with.
 */
Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) })

    if (req.method === 'POST') {
      if (!(await validSession(req))) return json(req, 401, { ok: false, error: 'unauthorized' })
      return json(req, 200, { ok: true, url: await feedUrl(), name: CALENDAR_NAME })
    }

    if (req.method === 'GET') {
      const token = new URL(req.url).searchParams.get('token') ?? ''
      if (!token || !safeEqual(token, await calendarToken())) {
        return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
      }
      const body = calendarFeed(await bookings(), {
        name: CALENDAR_NAME,
        location: CONTACT.addressFull,
        dashboard: `${SITE_URL}/admin`,
        domain: 'bjornsbarber.nl',
      })
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': 'inline; filename="bjorns-barber.ics"',
          'Cache-Control': 'no-store',
        },
      })
    }

    return json(req, 405, { ok: false, error: 'method' })
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'unavailable')
    return new Response('Unavailable', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }
})
