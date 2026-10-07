import { copy, type ServiceId } from './content'
import type { Weekday } from './schedule'

/** A row in the `clients` table. */
export type ClientRecord = {
  id: string
  name: string
  email: string
  phone: string
  note: string
  created_at: string
}

/** The booking fields the client overview needs. */
export type ClientBooking = {
  id: string
  service: ServiceId
  name: string
  email: string
  phone: string
  start: string
  status: 'confirmed' | 'pending' | 'declined'
  price: string | null
  /** Service price after discount, when it was changed. */
  charged?: number | null
  /** Products sold with the appointment. */
  items?: { price: number; quantity: number }[]
}

export type DayPart = 'ochtend' | 'middag' | 'avond'

export type ClientSummary = {
  key: string
  /** Set when the client exists in the `clients` table. */
  id: string | null
  name: string
  email: string
  phone: string
  note: string
  since: string | null
  /** Confirmed appointments that already happened. */
  visits: number
  /** Confirmed appointments still to come. */
  upcoming: number
  /** Euros paid over all visits. */
  paid: number
  lastVisit: string | null
  nextVisit: string | null
  favoriteDay: Weekday | null
  favoritePart: DayPart | null
  favoriteTime: string | null
  bookings: ClientBooking[]
}

const WEEKDAYS: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
/** Monday first, for tie-breaks and select options. */
export const WEEK_ORDER: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
export const DAY_PARTS: DayPart[] = ['ochtend', 'middag', 'avond']

export function dayLabel(weekday: Weekday): string {
  return copy.nl.days.find((item) => item.key === weekday)?.label ?? weekday
}

/** "€30", "€ 32,50", "30" → euros. Anything unreadable counts as 0. */
export function parsePrice(price: string | null | undefined): number {
  if (!price) return 0
  const cleaned = price.replace(/[^\d,.-]/g, '').replace(',', '.')
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : 0
}

export function formatEuro(value: number): string {
  const rounded = Math.round(value * 100) / 100
  return Number.isInteger(rounded) ? `€${rounded}` : `€${rounded.toFixed(2).replace('.', ',')}`
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, '')
}

/** One person, however they booked: by mail first, then phone, then name. */
export function clientKey(person: { email: string; phone: string; name: string }): string {
  const email = normalizeEmail(person.email)
  if (email) return `mail:${email}`
  const digits = phoneDigits(person.phone)
  if (digits.length >= 6) return `tel:${digits}`
  return `naam:${person.name.trim().toLowerCase()}`
}

export function dayPartOf(time: string): DayPart {
  const hour = Number(time.slice(0, 2))
  if (hour < 12) return 'ochtend'
  if (hour < 17) return 'middag'
  return 'avond'
}

function weekdayOf(start: string): Weekday {
  return WEEKDAYS[new Date(`${start.slice(0, 10)}T12:00:00`).getDay()]
}

/** The most common value; ties go to whichever comes first in `order`. */
function mostCommon<T extends string>(values: T[], order?: readonly T[]): T | null {
  if (values.length === 0) return null
  const counts = new Map<T, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  const ranked = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    if (order) return order.indexOf(a[0]) - order.indexOf(b[0])
    return a[0].localeCompare(b[0])
  })
  return ranked[0][0]
}

function wallNow(now: Date): string {
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:00`
}

/**
 * Merge stored clients with everyone who ever booked, and work out how often
 * they came, what they paid and when they usually come.
 * `prices` fills in bookings made before the price was stored on the booking.
 */
export function summarizeClients(
  clients: ClientRecord[],
  bookings: ClientBooking[],
  prices: Partial<Record<ServiceId, string>>,
  now = new Date(),
): ClientSummary[] {
  const today = wallNow(now)
  const byKey = new Map<string, ClientSummary>()

  const ensure = (person: { email: string; phone: string; name: string }) => {
    const key = clientKey(person)
    let found = byKey.get(key)
    if (!found) {
      found = {
        key,
        id: null,
        name: person.name.trim(),
        email: normalizeEmail(person.email),
        phone: person.phone.trim(),
        note: '',
        since: null,
        visits: 0,
        upcoming: 0,
        paid: 0,
        lastVisit: null,
        nextVisit: null,
        favoriteDay: null,
        favoritePart: null,
        favoriteTime: null,
        bookings: [],
      }
      byKey.set(key, found)
    }
    return found
  }

  for (const client of clients) {
    const summary = ensure(client)
    summary.id = client.id
    summary.name = client.name.trim() || summary.name
    summary.note = client.note ?? ''
    summary.since = client.created_at ? client.created_at.slice(0, 10) : null
    if (client.phone.trim()) summary.phone = client.phone.trim()
  }

  const sorted = bookings.slice().sort((a, b) => a.start.localeCompare(b.start))
  for (const booking of sorted) {
    const summary = ensure(booking)
    summary.bookings.push(booking)
    if (!summary.phone && booking.phone.trim()) summary.phone = booking.phone.trim()
    if (!summary.since || booking.start.slice(0, 10) < summary.since) summary.since = booking.start.slice(0, 10)
    if (booking.status !== 'confirmed') continue
    if (booking.start <= today) {
      summary.visits += 1
      const service = booking.charged ?? parsePrice(booking.price ?? prices[booking.service] ?? null)
      const products = (booking.items ?? []).reduce((sum, item) => sum + item.price * item.quantity, 0)
      summary.paid += service + products
      summary.lastVisit = booking.start
    } else {
      summary.upcoming += 1
      if (!summary.nextVisit) summary.nextVisit = booking.start
    }
  }

  for (const summary of byKey.values()) {
    const confirmed = summary.bookings.filter((booking) => booking.status === 'confirmed')
    summary.favoriteDay = mostCommon(confirmed.map((booking) => weekdayOf(booking.start)), WEEK_ORDER)
    const times = confirmed.map((booking) => booking.start.slice(11, 16))
    summary.favoritePart = mostCommon(times.map(dayPartOf), DAY_PARTS)
    summary.favoriteTime = mostCommon(times)
  }

  return [...byKey.values()]
}

export type Recency = '' | 'month' | 'quarter' | 'away' | 'never'
export type ClientSort = 'visits' | 'paid' | 'last' | 'name' | 'new'

export type ClientFilter = {
  query: string
  minVisits: number
  minPaid: number
  day: Weekday | ''
  part: DayPart | ''
  recency: Recency
  sort: ClientSort
}

export const EMPTY_FILTER: ClientFilter = {
  query: '',
  minVisits: 0,
  minPaid: 0,
  day: '',
  part: '',
  recency: '',
  sort: 'visits',
}

function daysSince(start: string, now: Date): number {
  const then = new Date(`${start.slice(0, 10)}T12:00:00`).getTime()
  const today = new Date(`${wallNow(now).slice(0, 10)}T12:00:00`).getTime()
  return Math.round((today - then) / 86_400_000)
}

function matchesRecency(summary: ClientSummary, recency: Recency, now: Date): boolean {
  if (!recency) return true
  if (recency === 'never') return summary.visits === 0
  if (!summary.lastVisit) return false
  const days = daysSince(summary.lastVisit, now)
  if (recency === 'month') return days <= 31
  if (recency === 'quarter') return days > 31 && days <= 92
  return days > 92
}

export function filterClients(list: ClientSummary[], filter: ClientFilter, now = new Date()): ClientSummary[] {
  const words = filter.query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const kept = list.filter((summary) => {
    if (summary.visits < filter.minVisits) return false
    if (summary.paid < filter.minPaid) return false
    if (filter.day && summary.favoriteDay !== filter.day) return false
    if (filter.part && summary.favoritePart !== filter.part) return false
    if (!matchesRecency(summary, filter.recency, now)) return false
    if (words.length > 0) {
      const haystack = `${summary.name} ${summary.email} ${summary.phone} ${phoneDigits(summary.phone)} ${summary.note}`.toLowerCase()
      if (!words.every((word) => haystack.includes(word))) return false
    }
    return true
  })
  const byName = (a: ClientSummary, b: ClientSummary) => a.name.localeCompare(b.name, 'nl')
  return kept.sort((a, b) => {
    switch (filter.sort) {
      case 'paid':
        return b.paid - a.paid || b.visits - a.visits || byName(a, b)
      case 'last':
        return (b.lastVisit ?? '').localeCompare(a.lastVisit ?? '') || byName(a, b)
      case 'name':
        return byName(a, b)
      case 'new':
        return (b.since ?? '').localeCompare(a.since ?? '') || byName(a, b)
      default:
        return b.visits - a.visits || b.paid - a.paid || byName(a, b)
    }
  })
}

export function filterActive(filter: ClientFilter): boolean {
  return Boolean(
    filter.query.trim() || filter.minVisits || filter.minPaid || filter.day || filter.part || filter.recency,
  )
}
