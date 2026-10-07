import { expect, test } from 'vitest'
import {
  bookingMoney,
  byMonth,
  discountFromPrice,
  formatMoney,
  parseMoney,
  priceFromDiscount,
  reportCsv,
  settled,
  summarize,
  vatIn,
  type Billable,
} from './finance'

const PRICES = { cut: '€30', beard: '€15', both: '€40' } as const
const NAMES = { cut: 'Knippen', beard: 'Baard', both: 'Knippen + baard' }

function booking(id: string, start: string, extra: Partial<Billable> = {}): Billable {
  return {
    id,
    service: 'cut',
    name: 'Sam de Boer',
    email: 'sam@mail.nl',
    start,
    status: 'confirmed',
    price: '€30',
    charged: null,
    items: [],
    ...extra,
  }
}

test('money parses Dutch and English input and formats with a comma', () => {
  expect(parseMoney('32,50')).toBe(32.5)
  expect(parseMoney('€ 32.5')).toBe(32.5)
  expect(parseMoney('30')).toBe(30)
  expect(parseMoney('abc')).toBeNull()
  expect(parseMoney('')).toBeNull()
  expect(formatMoney(30)).toBe('€30')
  expect(formatMoney(32.5)).toBe('€32,50')
  expect(formatMoney(-5)).toBe('-€5')
})

test('discount and price are the same number seen from two sides', () => {
  expect(discountFromPrice(30, 25)).toBe(5)
  expect(priceFromDiscount(30, 5)).toBe(25)
  expect(priceFromDiscount(30, 40)).toBe(0)
  expect(discountFromPrice(30, 35)).toBe(-5)
})

test('an appointment adds up the service after discount and the products', () => {
  const money = bookingMoney(
    booking('1', '2026-10-01T10:00:00', {
      charged: 25,
      items: [
        { productId: 'p1', name: 'Wax', listPrice: 12, price: 10, quantity: 2 },
        { productId: 'p2', name: 'Kam', listPrice: 4, price: 4, quantity: 1 },
      ],
    }),
    PRICES,
  )
  expect(money).toEqual({
    serviceList: 30,
    servicePrice: 25,
    productsList: 28,
    productsTotal: 24,
    discount: 9,
    total: 49,
    pieces: 3,
  })
})

test('a booking without a stored price uses today’s price for its service', () => {
  const money = bookingMoney(booking('1', '2026-10-01T10:00:00', { service: 'both', price: null }), PRICES)
  expect(money.serviceList).toBe(40)
  expect(money.total).toBe(40)
})

test('only confirmed appointments that already happened count as income', () => {
  const now = new Date('2026-10-15T12:00:00')
  const rows = [
    booking('past', '2026-10-01T10:00:00'),
    booking('today-earlier', '2026-10-15T09:00:00'),
    booking('today-later', '2026-10-15T15:00:00'),
    booking('pending', '2026-10-02T10:00:00', { status: 'pending' }),
    booking('declined', '2026-10-03T10:00:00', { status: 'declined' }),
  ]
  expect(settled(rows, now).map((row) => row.id)).toEqual(['past', 'today-earlier'])
})

test('a summary totals services, products, discount and VAT', () => {
  const summary = summarize(
    [
      booking('1', '2026-10-01T10:00:00', { charged: 25 }),
      booking('2', '2026-10-02T10:00:00', { items: [{ productId: 'p1', name: 'Wax', listPrice: 10, price: 10, quantity: 1 }] }),
      booking('3', '2026-10-03T10:00:00', { service: 'beard', price: '€15' }),
    ],
    PRICES,
  )
  expect(summary.appointments).toBe(3)
  expect(summary.services).toBe(70)
  expect(summary.products).toBe(10)
  expect(summary.pieces).toBe(1)
  expect(summary.discount).toBe(5)
  expect(summary.total).toBe(80)
  expect(summary.vatServices).toBe(vatIn(70, 9))
  expect(summary.vatProducts).toBe(vatIn(10, 21))
  expect(summary.average).toBe(26.67)
  expect(vatIn(109, 9)).toBe(9)
  expect(vatIn(121, 21)).toBe(21)
})

test('months are grouped newest first', () => {
  const months = byMonth(
    [booking('1', '2026-09-30T10:00:00'), booking('2', '2026-10-01T10:00:00'), booking('3', '2026-10-20T10:00:00')],
    PRICES,
  )
  expect(months.map((item) => item.month)).toEqual(['2026-10', '2026-09'])
  expect(months[0].summary.appointments).toBe(2)
})

test('the CSV has one line per appointment with Dutch decimals and escaped text', () => {
  const csv = reportCsv(
    [
      booking('2', '2026-10-02T14:30:00', {
        name: 'Kim "KJ" Jansen',
        charged: 27.5,
        items: [{ productId: 'p1', name: 'Wax; groot', listPrice: 12, price: 12, quantity: 1 }],
      }),
      booking('1', '2026-10-01T10:00:00'),
    ],
    PRICES,
    NAMES,
  )
  const lines = csv.trim().split('\r\n')
  expect(lines[0]).toBe(
    'Datum;Tijd;Klant;E-mail;Dienst;Dienst lijstprijs;Dienst prijs;Producten;Producten totaal;Korting;Totaal incl. btw;Btw diensten 9%;Btw producten 21%',
  )
  expect(lines[1]).toBe('2026-10-01;10:00;Sam de Boer;sam@mail.nl;Knippen;30,00;30,00;;0,00;0,00;30,00;2,48;0,00')
  expect(lines[2]).toBe(
    '2026-10-02;14:30;"Kim ""KJ"" Jansen";sam@mail.nl;Knippen;30,00;27,50;"1× Wax; groot €12";12,00;2,50;39,50;2,27;2,08',
  )
})
