import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { InboxRow } from '../../planning-api'
import { AdminFinance } from './AdminFinance'

const PRICES = { cut: '€30', beard: '€15', both: '€40' }

function row(id: string, start: string, extra: Partial<InboxRow> = {}): InboxRow {
  return {
    id,
    service: 'cut',
    name: 'Sam',
    email: 'sam@mail.nl',
    phone: '0612345678',
    start,
    minutes: 45,
    kind: 'slot',
    status: 'confirmed',
    lang: 'nl',
    mail_sent: true,
    price: '€30',
    charged: null,
    items: [],
    ...extra,
  }
}

const rows: InboxRow[] = [
  row('a', '2026-10-01T10:00:00', { charged: 25 }),
  row('b', '2026-10-03T11:00:00', {
    name: 'Kim',
    items: [{ productId: 'p1', name: 'Wax', listPrice: 12, price: 12, quantity: 2 }],
  }),
  row('c', '2026-09-20T10:00:00', { service: 'both', price: '€40' }),
  row('d', '2025-12-02T10:00:00'),
  row('future', '2026-10-30T10:00:00'),
  row('pending', '2026-10-02T10:00:00', { status: 'pending' }),
]

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-15T12:00:00'))
})

afterEach(() => {
  vi.useRealTimers()
})

function tile(label: string) {
  const term = screen.getAllByText(label).find((element) => element.tagName === 'DT')
  if (!term) throw new Error(`missing tile ${label}`)
  return term.nextElementSibling
}

test('this month shows the settled appointments with services, products, discount and VAT', () => {
  render(<AdminFinance rows={rows} prices={PRICES} />)
  expect(screen.getByRole('heading', { level: 2, name: 'oktober 2026' })).toBeInTheDocument()
  expect(tile('Omzet')).toHaveTextContent('€79')
  expect(tile('Diensten')).toHaveTextContent('€55')
  expect(tile('Producten')).toHaveTextContent('€24')
  expect(tile('Korting gegeven')).toHaveTextContent('€5')
  expect(tile('Afspraken')).toHaveTextContent('2')
  const report = screen.getByRole('region', { name: 'Omzetrapport oktober 2026' })
  expect(within(report).getByText('waarvan btw €4,54')).toBeInTheDocument()
  expect(within(report).getByText('waarvan btw €4,17')).toBeInTheDocument()
  expect(within(report).getByText('2× Wax €24')).toBeInTheDocument()
  expect(screen.getByText(/Nog te komen: 1 bevestigde afspraak ter waarde van €30/)).toBeInTheDocument()
})

test('year and all-time views group by month and year', async () => {
  render(<AdminFinance rows={rows} prices={PRICES} />)
  await userEvent.click(screen.getByRole('tab', { name: 'Jaar' }))
  expect(screen.getByRole('heading', { level: 2, name: '2026' })).toBeInTheDocument()
  expect(tile('Omzet')).toHaveTextContent('€119')
  expect(screen.getByRole('rowheader', { name: 'oktober 2026' })).toBeInTheDocument()
  expect(screen.getByRole('rowheader', { name: 'september 2026' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('tab', { name: 'Alles' }))
  expect(tile('Omzet')).toHaveTextContent('€149')
  expect(screen.getByRole('rowheader', { name: '2025' })).toBeInTheDocument()
  expect(screen.getByRole('rowheader', { name: 'december 2025' })).toBeInTheDocument()
})

test('the CSV for the bookkeeper carries one line per appointment', async () => {
  const urls: Blob[] = []
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: (blob: Blob) => {
      urls.push(blob)
      return 'blob:test'
    },
    revokeObjectURL: () => {},
  })
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  try {
    render(<AdminFinance rows={rows} prices={PRICES} />)
    await userEvent.click(screen.getByRole('button', { name: 'Download CSV voor de boekhouder' }))
    expect(click).toHaveBeenCalled()
    expect(urls).toHaveLength(1)
    expect(urls[0].type).toBe('text/csv;charset=utf-8')
    const bytes = new Uint8Array(await urls[0].arrayBuffer())
    // UTF-8 byte-order mark, so Excel reads the € sign.
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf])
    const text = new TextDecoder().decode(bytes)
    expect(text.startsWith('Datum;Tijd;Klant')).toBe(true)
    expect(text).toContain('2026-10-01;10:00;Sam;sam@mail.nl;Knippen;30,00;25,00;;0,00;5,00;25,00')
    expect(text).toContain('2026-10-03;11:00;Kim;sam@mail.nl;Knippen;30,00;30,00;2× Wax €12;24,00;0,00;54,00')
    expect(text).not.toContain('2026-10-30')
  } finally {
    click.mockRestore()
    vi.unstubAllGlobals()
  }
})
