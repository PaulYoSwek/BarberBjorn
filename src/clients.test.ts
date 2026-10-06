import { expect, test } from 'vitest'
import {
  clientKey,
  EMPTY_FILTER,
  filterClients,
  formatEuro,
  parsePrice,
  summarizeClients,
  type ClientBooking,
  type ClientRecord,
} from './clients'

const NOW = new Date('2026-10-20T12:00:00')
const PRICES = { cut: '€30', beard: '€15', both: '€40' } as const

function booking(id: string, start: string, extra: Partial<ClientBooking> = {}): ClientBooking {
  return {
    id,
    service: 'cut',
    name: 'Sam de Boer',
    email: 'Sam@Mail.nl',
    phone: '06 1234 5678',
    start,
    status: 'confirmed',
    price: null,
    ...extra,
  }
}

test('prices read from euro strings', () => {
  expect(parsePrice('€30')).toBe(30)
  expect(parsePrice('€ 32,50')).toBe(32.5)
  expect(parsePrice('40')).toBe(40)
  expect(parsePrice('gratis')).toBe(0)
  expect(parsePrice(null)).toBe(0)
  expect(formatEuro(30)).toBe('€30')
  expect(formatEuro(32.5)).toBe('€32,50')
})

test('the same person is matched by mail regardless of case, then by phone', () => {
  expect(clientKey({ email: ' SAM@mail.nl ', phone: '', name: 'x' })).toBe('mail:sam@mail.nl')
  expect(clientKey({ email: '', phone: '06-1234 5678', name: 'x' })).toBe('tel:0612345678')
  expect(clientKey({ email: '', phone: '', name: ' Kim ' })).toBe('naam:kim')
})

test('visits, paid, last and next visit and the usual day and time', () => {
  const list = summarizeClients(
    [],
    [
      booking('1', '2026-09-01T10:00:00'),
      booking('2', '2026-09-15T10:30:00', { service: 'both' }),
      booking('3', '2026-09-29T10:00:00', { price: '€35' }),
      booking('4', '2026-10-06T16:00:00', { status: 'declined' }),
      booking('5', '2026-10-27T10:00:00'),
      booking('6', '2026-11-03T10:00:00', { status: 'pending' }),
    ],
    PRICES,
    NOW,
  )
  expect(list).toHaveLength(1)
  const sam = list[0]
  expect(sam.visits).toBe(3)
  // €30 + €40 + the €35 stored on the third booking. Declined and pending do not count.
  expect(sam.paid).toBe(105)
  expect(sam.upcoming).toBe(1)
  expect(sam.lastVisit).toBe('2026-09-29T10:00:00')
  expect(sam.nextVisit).toBe('2026-10-27T10:00:00')
  expect(sam.favoriteDay).toBe('tue')
  expect(sam.favoritePart).toBe('ochtend')
  expect(sam.favoriteTime).toBe('10:00')
  expect(sam.since).toBe('2026-09-01')
  expect(sam.email).toBe('sam@mail.nl')
})

test('a stored client without bookings shows up and merges with later bookings', () => {
  const stored: ClientRecord[] = [
    { id: 'c1', name: 'Kim Jansen', email: 'kim@mail.nl', phone: '', note: 'Kort opzij', created_at: '2026-08-01T09:00:00Z' },
    { id: 'c2', name: 'Lou', email: '', phone: '0698765432', note: '', created_at: '2026-08-02T09:00:00Z' },
  ]
  const list = summarizeClients(
    stored,
    [booking('1', '2026-10-01T15:00:00', { name: 'Kim J', email: 'KIM@mail.nl', phone: '0611111111' })],
    PRICES,
    NOW,
  )
  expect(list).toHaveLength(2)
  const kim = list.find((item) => item.id === 'c1')!
  expect(kim.name).toBe('Kim Jansen')
  expect(kim.note).toBe('Kort opzij')
  expect(kim.visits).toBe(1)
  expect(kim.phone).toBe('0611111111')
  expect(kim.since).toBe('2026-08-01')
  const lou = list.find((item) => item.id === 'c2')!
  expect(lou.visits).toBe(0)
  expect(lou.favoriteDay).toBeNull()
})

const people = summarizeClients(
  [],
  [
    // Ada: 3 visits on Mondays in the morning, last one last week.
    booking('a1', '2026-09-28T09:00:00', { name: 'Ada', email: 'ada@x.nl' }),
    booking('a2', '2026-10-05T09:30:00', { name: 'Ada', email: 'ada@x.nl' }),
    booking('a3', '2026-10-12T09:00:00', { name: 'Ada', email: 'ada@x.nl', service: 'both' }),
    // Bo: 1 visit on a Friday evening, months ago.
    booking('b1', '2026-05-01T18:00:00', { name: 'Bo', email: 'bo@x.nl', service: 'beard' }),
    // Cas: only an upcoming booking.
    booking('c1', '2026-10-29T13:00:00', { name: 'Cas', email: 'cas@x.nl', phone: '0655555555' }),
  ],
  PRICES,
  NOW,
)

function names(filter: Partial<typeof EMPTY_FILTER>) {
  return filterClients(people, { ...EMPTY_FILTER, ...filter }, NOW).map((item) => item.name)
}

test('filters on visits, paid, usual day, day part and how long ago', () => {
  expect(names({})).toEqual(['Ada', 'Bo', 'Cas'])
  expect(names({ minVisits: 2 })).toEqual(['Ada'])
  expect(names({ minPaid: 15 })).toEqual(['Ada', 'Bo'])
  expect(names({ minPaid: 50 })).toEqual(['Ada'])
  expect(names({ day: 'fri' })).toEqual(['Bo'])
  expect(names({ part: 'avond' })).toEqual(['Bo'])
  expect(names({ part: 'middag' })).toEqual(['Cas'])
  expect(names({ recency: 'month' })).toEqual(['Ada'])
  expect(names({ recency: 'away' })).toEqual(['Bo'])
  expect(names({ recency: 'never' })).toEqual(['Cas'])
  expect(names({ query: '0655' })).toEqual(['Cas'])
  expect(names({ query: 'ADA@x' })).toEqual(['Ada'])
})

test('sorts by paid, last visit, name and newest', () => {
  expect(names({ sort: 'paid' })).toEqual(['Ada', 'Bo', 'Cas'])
  expect(names({ sort: 'last' })).toEqual(['Ada', 'Bo', 'Cas'])
  expect(names({ sort: 'name' })).toEqual(['Ada', 'Bo', 'Cas'])
  expect(names({ sort: 'new' })).toEqual(['Cas', 'Ada', 'Bo'])
})
