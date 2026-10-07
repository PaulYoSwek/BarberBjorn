import { parsePrice } from './clients'
import type { ServiceId } from './content'

/** One product line on an appointment. Prices are euros per piece. */
export type OrderItem = {
  id?: string
  productId: string | null
  name: string
  listPrice: number
  price: number
  quantity: number
}

export type Product = {
  id: string
  name: string
  price: number
  stock: number
  active: boolean
}

/** The part of a booking the money maths needs. */
export type Billable = {
  id: string
  service: ServiceId
  name: string
  email: string
  start: string
  status: 'confirmed' | 'pending' | 'declined'
  price: string | null
  charged: number | null
  items: OrderItem[]
}

/** Dutch VAT: hairdressing is in the low rate, goods in the high rate. Prices include VAT. */
export const VAT_SERVICES = 9
export const VAT_PRODUCTS = 21

export function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** "32,50" or "32.50" or "€32" → euros; anything unreadable → null. */
export function parseMoney(text: string): number | null {
  const cleaned = text.replace(/[^\d,.-]/g, '').replace(',', '.')
  if (!cleaned || cleaned === '-' || cleaned === '.') return null
  const value = Number(cleaned)
  return Number.isFinite(value) ? round2(value) : null
}

export function formatMoney(value: number): string {
  const rounded = round2(value)
  const sign = rounded < 0 ? '-' : ''
  const abs = Math.abs(rounded)
  const whole = Math.floor(abs)
  const cents = Math.round((abs - whole) * 100)
  return cents === 0 ? `${sign}€${whole}` : `${sign}€${whole},${String(cents).padStart(2, '0')}`
}

/** Discount and price are two sides of one number: list − price. Either can be typed. */
export function discountFromPrice(listPrice: number, price: number): number {
  return round2(listPrice - price)
}

export function priceFromDiscount(listPrice: number, discount: number): number {
  return round2(Math.max(0, listPrice - discount))
}

/** The service's list price: what was stored on the booking, else today's price. */
export function serviceListPrice(booking: Pick<Billable, 'price' | 'service'>, prices: Partial<Record<ServiceId, string>>): number {
  return parsePrice(booking.price ?? prices[booking.service] ?? null)
}

export type BookingMoney = {
  serviceList: number
  servicePrice: number
  productsList: number
  productsTotal: number
  discount: number
  total: number
  pieces: number
}

export function bookingMoney(booking: Pick<Billable, 'price' | 'service' | 'charged' | 'items'>, prices: Partial<Record<ServiceId, string>>): BookingMoney {
  const serviceList = serviceListPrice(booking, prices)
  const servicePrice = booking.charged ?? serviceList
  let productsList = 0
  let productsTotal = 0
  let pieces = 0
  for (const item of booking.items ?? []) {
    productsList += item.listPrice * item.quantity
    productsTotal += item.price * item.quantity
    pieces += item.quantity
  }
  return {
    serviceList: round2(serviceList),
    servicePrice: round2(servicePrice),
    productsList: round2(productsList),
    productsTotal: round2(productsTotal),
    discount: round2(serviceList - servicePrice + productsList - productsTotal),
    total: round2(servicePrice + productsTotal),
    pieces,
  }
}

/** VAT contained in a price that includes it. */
export function vatIn(amount: number, rate: number): number {
  return round2((amount * rate) / (100 + rate))
}

export type Period = { kind: 'month'; month: string } | { kind: 'year'; year: string } | { kind: 'all' }

export function periodLabel(period: Period, months: string[]): string {
  if (period.kind === 'all') return 'Alles'
  if (period.kind === 'year') return period.year
  return `${months[Number(period.month.slice(5, 7)) - 1]} ${period.month.slice(0, 4)}`
}

export function inPeriod(start: string, period: Period): boolean {
  if (period.kind === 'all') return true
  if (period.kind === 'year') return start.startsWith(period.year)
  return start.startsWith(period.month)
}

function wallNow(now: Date): string {
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:00`
}

/** Appointments that count as income: confirmed and already happened. */
export function settled(bookings: Billable[], now = new Date()): Billable[] {
  const today = wallNow(now)
  return bookings.filter((booking) => booking.status === 'confirmed' && booking.start <= today)
}

export type Summary = {
  appointments: number
  services: number
  products: number
  pieces: number
  discount: number
  total: number
  vatServices: number
  vatProducts: number
  average: number
}

export function summarize(bookings: Billable[], prices: Partial<Record<ServiceId, string>>): Summary {
  const sum: Summary = {
    appointments: 0,
    services: 0,
    products: 0,
    pieces: 0,
    discount: 0,
    total: 0,
    vatServices: 0,
    vatProducts: 0,
    average: 0,
  }
  for (const booking of bookings) {
    const money = bookingMoney(booking, prices)
    sum.appointments += 1
    sum.services += money.servicePrice
    sum.products += money.productsTotal
    sum.pieces += money.pieces
    sum.discount += money.discount
    sum.total += money.total
  }
  sum.services = round2(sum.services)
  sum.products = round2(sum.products)
  sum.discount = round2(sum.discount)
  sum.total = round2(sum.total)
  sum.vatServices = vatIn(sum.services, VAT_SERVICES)
  sum.vatProducts = vatIn(sum.products, VAT_PRODUCTS)
  sum.average = sum.appointments ? round2(sum.total / sum.appointments) : 0
  return sum
}

/** Summaries per month (key "YYYY-MM"), newest first. */
export function byMonth(bookings: Billable[], prices: Partial<Record<ServiceId, string>>): { month: string; summary: Summary }[] {
  const groups = new Map<string, Billable[]>()
  for (const booking of bookings) {
    const month = booking.start.slice(0, 7)
    groups.set(month, [...(groups.get(month) ?? []), booking])
  }
  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, rows]) => ({ month, summary: summarize(rows, prices) }))
}

/** Summaries per year, newest first. */
export function byYear(bookings: Billable[], prices: Partial<Record<ServiceId, string>>): { year: string; summary: Summary }[] {
  const groups = new Map<string, Billable[]>()
  for (const booking of bookings) {
    const year = booking.start.slice(0, 4)
    groups.set(year, [...(groups.get(year) ?? []), booking])
  }
  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, rows]) => ({ year, summary: summarize(rows, prices) }))
}

function csvCell(value: string | number): string {
  const text = typeof value === 'number' ? value.toFixed(2).replace('.', ',') : value
  return /[";\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/**
 * One line per appointment, semicolon separated with a comma as decimal sign,
 * the way Dutch Excel and most bookkeepers expect it.
 */
export function reportCsv(
  bookings: Billable[],
  prices: Partial<Record<ServiceId, string>>,
  serviceNames: Record<ServiceId, string>,
): string {
  const head = [
    'Datum',
    'Tijd',
    'Klant',
    'E-mail',
    'Dienst',
    'Dienst lijstprijs',
    'Dienst prijs',
    'Producten',
    'Producten totaal',
    'Korting',
    'Totaal incl. btw',
    `Btw diensten ${VAT_SERVICES}%`,
    `Btw producten ${VAT_PRODUCTS}%`,
  ]
  const lines = [head.map(csvCell).join(';')]
  const sorted = bookings.slice().sort((a, b) => a.start.localeCompare(b.start))
  for (const booking of sorted) {
    const money = bookingMoney(booking, prices)
    const products = (booking.items ?? []).map((item) => `${item.quantity}× ${item.name} ${formatMoney(item.price)}`).join(', ')
    lines.push(
      [
        booking.start.slice(0, 10),
        booking.start.slice(11, 16),
        booking.name,
        booking.email,
        serviceNames[booking.service],
        money.serviceList,
        money.servicePrice,
        products,
        money.productsTotal,
        money.discount,
        money.total,
        vatIn(money.servicePrice, VAT_SERVICES),
        vatIn(money.productsTotal, VAT_PRODUCTS),
      ]
        .map(csvCell)
        .join(';'),
    )
  }
  return lines.join('\r\n') + '\r\n'
}
