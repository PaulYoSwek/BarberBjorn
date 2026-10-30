/**
 * The booked appointments as an iCalendar feed, for Google Calendar, Outlook
 * and Apple Calendar to subscribe to. Pure text building, shared by the edge
 * function and the tests.
 */

export type FeedBooking = {
  id: string
  name: string
  email: string
  phone: string
  /** The service as Bjorn named it. */
  service: string
  /** UTC instant, ISO 8601. */
  start: string
  minutes: number
  price: string | null
  /** Undefined when payment is not tracked. */
  paid?: boolean
}

export type FeedInfo = {
  name: string
  location: string
  dashboard: string
  /** Domain for the event ids, so they stay unique across calendars. */
  domain: string
}

/** iCalendar text: backslash, semicolon, comma and line breaks are escaped. */
function text(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** 2026-10-30T09:15:00.000Z → 20261030T091500Z */
function stamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** Lines longer than 75 octets continue on the next line after a space (RFC 5545). */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line
  const parts: string[] = []
  let current = ''
  let size = 0
  for (const char of line) {
    const length = new TextEncoder().encode(char).length
    const limit = parts.length === 0 ? 75 : 74
    if (size + length > limit) {
      parts.push(current)
      current = ''
      size = 0
    }
    current += char
    size += length
  }
  parts.push(current)
  return parts.join('\r\n ')
}

export function calendarFeed(bookings: FeedBooking[], info: FeedInfo, now = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${info.domain}//Afspraken//NL`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${text(info.name)}`,
    'X-WR-TIMEZONE:Europe/Amsterdam',
    // A hint to refresh hourly; Google and Outlook pick their own pace.
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ]
  const created = stamp(now)
  for (const booking of bookings) {
    const start = new Date(booking.start)
    if (Number.isNaN(start.getTime())) continue
    const end = new Date(start.getTime() + booking.minutes * 60_000)
    const details = [
      `${booking.service} · ${booking.minutes} min${booking.price ? ` · ${booking.price}` : ''}`,
      booking.paid === true ? 'Betaald' : booking.paid === false ? 'Nog niet betaald' : '',
      booking.phone ? `Telefoon: ${booking.phone}` : '',
      booking.email ? `E-mail: ${booking.email}` : '',
      `Dashboard: ${info.dashboard}`,
    ].filter(Boolean)
    lines.push(
      'BEGIN:VEVENT',
      `UID:${booking.id}@${info.domain}`,
      `DTSTAMP:${created}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${text(`${booking.name} · ${booking.service}`)}`,
      `DESCRIPTION:${text(details.join('\n'))}`,
      `LOCATION:${text(info.location)}`,
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

/** Links that open the subscribe screen of each calendar app for a feed URL. */
export function subscribeLinks(url: string, name: string) {
  const webcal = url.replace(/^https?:\/\//, 'webcal://')
  return {
    google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`,
    outlook: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`,
    apple: webcal,
  }
}
