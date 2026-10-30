import { expect, test } from 'vitest'
import { calendarFeed, subscribeLinks } from './calendar-feed'

const info = { name: 'Bjorn’s Barber afspraken', location: 'Ferdinandstraat 21, 4571 AN Axel', dashboard: 'https://www.bjornsbarber.nl/admin', domain: 'bjornsbarber.nl' }

test('each booking becomes an event in UTC with its length, client and service', () => {
  const ics = calendarFeed(
    [
      {
        id: 'b1',
        name: 'Jan de Vries',
        email: 'jan@example.com',
        phone: '06 12345678',
        service: 'Knippen + baard',
        start: '2026-11-02T09:00:00.000Z',
        minutes: 75,
        price: '€35',
        paid: false,
      },
    ],
    info,
    new Date('2026-10-30T12:00:00Z'),
  )
  expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
  expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  expect(ics).toContain('UID:b1@bjornsbarber.nl')
  expect(ics).toContain('DTSTART:20261102T090000Z')
  expect(ics).toContain('DTEND:20261102T101500Z')
  expect(ics).toContain('SUMMARY:Jan de Vries · Knippen + baard')
  // Commas and line breaks are escaped; the address and details stay one property each.
  expect(ics).toContain('LOCATION:Ferdinandstraat 21\\, 4571 AN Axel')
  expect(ics.replace(/\r\n /g, '')).toContain('DESCRIPTION:Knippen + baard · 75 min · €35\\nNog niet betaald\\nTelefoon: 06 12345678')
  expect(ics).toContain('X-WR-CALNAME:Bjorn’s Barber afspraken')
})

test('long lines are folded so strict calendar apps accept them', () => {
  const ics = calendarFeed(
    [{ id: 'b2', name: 'A'.repeat(120), email: '', phone: '', service: 'Baard', start: '2026-11-02T09:00:00Z', minutes: 30, price: null }],
    info,
  )
  for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
  expect(ics.replace(/\r\n /g, '')).toContain(`SUMMARY:${'A'.repeat(120)} · Baard`)
})

test('subscribe links open Google, Outlook and Apple with the feed', () => {
  const links = subscribeLinks('https://x.supabase.co/functions/v1/calendar-feed?token=abc', 'Afspraken')
  expect(links.apple).toBe('webcal://x.supabase.co/functions/v1/calendar-feed?token=abc')
  expect(links.google).toBe(
    'https://calendar.google.com/calendar/render?cid=' + encodeURIComponent('webcal://x.supabase.co/functions/v1/calendar-feed?token=abc'),
  )
  expect(links.outlook).toContain('https://outlook.live.com/calendar/0/addfromweb?url=' + encodeURIComponent('https://x.supabase.co/functions/v1/calendar-feed?token=abc'))
  expect(links.outlook).toContain('&name=Afspraken')
})
