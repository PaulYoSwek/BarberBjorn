import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { defaultSchedule } from '../../schedule'
import { AdminShell } from './AdminShell'

const { loadInbox, decideInbox, loadPublicSchedule, moveBooking, loadTemplates, saveOrder, loadProducts, loadServices, adminWrite } = vi.hoisted(() => ({
  adminWrite: vi.fn(),
  loadInbox: vi.fn(),
  decideInbox: vi.fn(),
  loadPublicSchedule: vi.fn(),
  moveBooking: vi.fn(),
  loadTemplates: vi.fn(),
  saveOrder: vi.fn(),
  loadProducts: vi.fn(),
  loadServices: vi.fn(),
}))

vi.mock('../../planning-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../planning-api')>()
  return {
    ...actual,
    loadInbox,
    decideInbox,
    loadPublicSchedule,
    moveBooking,
    loadTemplates,
    saveOrder,
    loadProducts,
    loadServices,
    adminWrite,
  }
})

afterEach(() => {
  vi.useRealTimers()
})

const PRODUCTS = [
  { id: 'p1', name: 'Wax', price: 12.5, stock: 5, active: true },
  { id: 'p2', name: 'Kam', price: 4, stock: 0, active: true },
]

const pending = {
  id: 'pend-1',
  service: 'cut' as const,
  name: 'Sam Pending',
  email: 'sam@mail.nl',
  phone: '0612345678',
  start: '2026-10-08T14:00:00',
  minutes: 45,
  kind: 'custom' as const,
  status: 'pending' as const,
  lang: 'nl' as const,
  mail_sent: false,
  price: null,
  charged: null,
  items: [],
}

const confirmed = {
  id: 'conf-1',
  service: 'beard' as const,
  name: 'Kim Confirmed',
  email: 'kim@mail.nl',
  phone: '',
  start: '2026-10-06T10:00:00',
  minutes: 20,
  kind: 'slot' as const,
  status: 'confirmed' as const,
  lang: 'nl' as const,
  mail_sent: true,
  price: null,
  charged: null,
  items: [],
}

function row(name: string) {
  const item = screen.getByText(name).closest('li')
  if (!item) throw new Error(`missing row ${name}`)
  return item
}

beforeEach(() => {
  // The rows below sit in early October 2026; the dashboard reads them from Monday 5 October.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-05T08:00:00'))
  loadInbox.mockReset()
  decideInbox.mockReset()
  loadPublicSchedule.mockReset()
  decideInbox.mockResolvedValue({ ok: true })
  loadPublicSchedule.mockResolvedValue(defaultSchedule)
  moveBooking.mockReset()
  loadTemplates.mockReset()
  loadTemplates.mockResolvedValue([])
  saveOrder.mockReset()
  loadProducts.mockReset()
  loadProducts.mockResolvedValue({ ready: true, products: PRODUCTS })
  loadServices.mockReset()
  loadServices.mockResolvedValue([
    { id: 'cut', price: '€30', minutes: 45 },
    { id: 'beard', price: '€15', minutes: 30 },
    { id: 'both', price: '€40', minutes: 75 },
  ])
})

test('pending rows offer accept and decline and the badge counts them', async () => {
  loadInbox.mockResolvedValue([confirmed, pending])
  render(<AdminShell />)
  await userEvent.click(await screen.findByRole('button', { name: 'Afspraken 1' }))

  const items = screen.getAllByRole('listitem')
  expect(items[0]).toHaveTextContent('Sam Pending')
  expect(items[1]).toHaveTextContent('Kim Confirmed')

  const pendingRow = row('Sam Pending')
  const confirmedRow = row('Kim Confirmed')
  expect(within(pendingRow).getByRole('button', { name: 'Accepteer' })).toBeInTheDocument()
  expect(within(pendingRow).getByRole('button', { name: 'Weiger' })).toBeInTheDocument()
  expect(within(confirmedRow).queryByRole('button', { name: 'Accepteer' })).not.toBeInTheDocument()
  expect(within(confirmedRow).queryByRole('button', { name: 'Weiger' })).not.toBeInTheDocument()
  expect(within(confirmedRow).queryByText('Mail niet gegaan')).not.toBeInTheDocument()

  await userEvent.click(within(pendingRow).getByRole('button', { name: 'Accepteer' }))
  expect(decideInbox).toHaveBeenCalledWith('pend-1', 'accept')
})

test('a stale inbox load after a later accept does not restore pending buttons', async () => {
  const later = { ...pending, id: 'pend-2', name: 'Alex Late', email: 'alex@mail.nl' }
  let resolveStale: (rows: (typeof pending)[]) => void = () => {}
  const stale = new Promise<(typeof pending)[]>((resolve) => {
    resolveStale = resolve
  })
  loadInbox
    .mockResolvedValueOnce([pending, later])
    .mockReturnValueOnce(stale)
    .mockReturnValue(new Promise(() => {}))

  render(<AdminShell />)
  await userEvent.click(await screen.findByRole('button', { name: 'Afspraken 2' }))
  await userEvent.click(within(row('Sam Pending')).getByRole('button', { name: 'Accepteer' }))
  await waitFor(() => expect(loadInbox).toHaveBeenCalledTimes(2))
  await userEvent.click(within(row('Alex Late')).getByRole('button', { name: 'Accepteer' }))
  await waitFor(() => {
    expect(within(row('Alex Late')).queryByRole('button', { name: 'Accepteer' })).not.toBeInTheDocument()
  })

  await act(async () => {
    resolveStale([pending])
    await stale
  })

  expect(screen.getByText('Alex Late')).toBeInTheDocument()
  expect(within(row('Sam Pending')).queryByRole('button', { name: 'Accepteer' })).not.toBeInTheDocument()
  expect(within(row('Alex Late')).queryByRole('button', { name: 'Accepteer' })).not.toBeInTheDocument()
})

test('a late loadInbox does not restore pending buttons after accept', async () => {
  let resolveReload: (rows: (typeof pending)[]) => void = () => {}
  const reload = new Promise<(typeof pending)[]>((resolve) => {
    resolveReload = resolve
  })
  loadInbox.mockResolvedValueOnce([pending]).mockReturnValueOnce(reload)

  render(<AdminShell />)
  await userEvent.click(await screen.findByRole('button', { name: 'Afspraken 1' }))
  await userEvent.click(within(row('Sam Pending')).getByRole('button', { name: 'Accepteer' }))

  await waitFor(() => {
    expect(within(row('Sam Pending')).queryByRole('button', { name: 'Accepteer' })).not.toBeInTheDocument()
  })

  await act(async () => {
    resolveReload([pending])
    await reload
  })

  expect(within(row('Sam Pending')).queryByRole('button', { name: 'Accepteer' })).not.toBeInTheDocument()
  expect(within(row('Sam Pending')).queryByRole('button', { name: 'Weiger' })).not.toBeInTheDocument()
})

test('accept hides the decision buttons when the inbox reload fails', async () => {
  loadInbox.mockResolvedValueOnce([pending])
  render(<AdminShell />)
  await userEvent.click(await screen.findByRole('button', { name: 'Afspraken 1' }))
  loadInbox.mockRejectedValue(new Error('reload failed'))

  const pendingRow = row('Sam Pending')
  await userEvent.click(within(pendingRow).getByRole('button', { name: 'Accepteer' }))

  await waitFor(() => {
    expect(within(row('Sam Pending')).queryByRole('button', { name: 'Accepteer' })).not.toBeInTheDocument()
  })
  expect(within(row('Sam Pending')).queryByRole('button', { name: 'Weiger' })).not.toBeInTheDocument()
  expect(decideInbox).toHaveBeenCalledTimes(1)
  expect(decideInbox).toHaveBeenCalledWith('pend-1', 'accept')
})

test('decline calls decideInbox while the row is still pending', async () => {
  loadInbox.mockResolvedValue([pending])
  render(<AdminShell />)
  await userEvent.click(await screen.findByRole('button', { name: 'Afspraken 1' }))
  await userEvent.click(within(row('Sam Pending')).getByRole('button', { name: 'Weiger' }))
  expect(decideInbox).toHaveBeenCalledWith('pend-1', 'decline')
})

test('a failed inbox load shows an error and no fake clients', async () => {
  loadInbox.mockRejectedValue(new Error('permission denied'))
  render(<AdminShell />)
  await userEvent.click(screen.getByRole('button', { name: /Afspraken/ }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Afspraken laden mislukt.')
  expect(screen.queryByText('Jan de Vries')).not.toBeInTheDocument()
})

test('an empty inbox says so', async () => {
  loadInbox.mockResolvedValue([])
  render(<AdminShell />)
  await userEvent.click(screen.getByRole('button', { name: /Afspraken/ }))
  expect(await screen.findByText(/Nog geen afspraken/)).toBeInTheDocument()
})

test('an expired session sends the dashboard back to the gate', async () => {
  loadInbox.mockRejectedValue(new Error('unauthorized'))
  const onLogout = vi.fn()
  render(<AdminShell onLogout={onLogout} />)
  await waitFor(() => expect(onLogout).toHaveBeenCalledTimes(1))
})

test('accept reports an overlap in plain words', async () => {
  loadInbox.mockResolvedValue([pending])
  decideInbox.mockResolvedValue({ ok: false, error: 'overlap' })
  render(<AdminShell />)
  await userEvent.click(await screen.findByRole('button', { name: 'Afspraken 1' }))
  await userEvent.click(within(row('Sam Pending')).getByRole('button', { name: 'Accepteer' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Die tijd is al bezet')
  expect(within(row('Sam Pending')).getByRole('button', { name: 'Accepteer' })).toBeInTheDocument()
})

test('unsent mail offers a resend that opens Mail for that client', async () => {
  loadInbox.mockResolvedValue([{ ...confirmed, mail_sent: false }])
  render(<AdminShell />)
  await userEvent.click(await screen.findByRole('button', { name: 'Afspraken' }))
  const card = row('Kim Confirmed')
  expect(within(card).getByText('Mail niet gegaan')).toBeInTheDocument()
  await userEvent.click(within(card).getByRole('button', { name: 'Opnieuw mailen' }))
  expect(screen.getByRole('button', { name: 'Mail' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByLabelText('Klant')).toHaveValue('conf-1')
})

test('a pending request is not flagged as unsent mail and sits under Te beoordelen', async () => {
  loadInbox.mockResolvedValue([pending, confirmed])
  render(<AdminShell />)
  await userEvent.click(await screen.findByRole('button', { name: 'Afspraken 1' }))
  expect(within(row('Sam Pending')).queryByText('Mail niet gegaan')).not.toBeInTheDocument()
  expect(within(screen.getByRole('region', { name: 'Te beoordelen' })).getByText('Sam Pending')).toBeInTheDocument()
  expect(screen.getByText('1 nieuw')).toBeInTheDocument()
})

const TEMPLATES = [
  { key: 'thanks', lang: 'nl', subject: 'Je afspraak staat vast', body: 'Hoi {{name}}, {{service}} op {{date}} om {{time}}.' },
  { key: 'accepted', lang: 'nl', subject: 'Bevestigd', body: 'Ja {{name}}' },
  { key: 'declined', lang: 'nl', subject: 'Helaas', body: 'Nee {{name}}' },
  { key: 'moved', lang: 'nl', subject: 'Verplaatst', body: 'Nieuw: {{date}} om {{time}}' },
]

test('Opnieuw mailen opens Mail with the booking template already filled in', async () => {
  loadTemplates.mockResolvedValue(TEMPLATES)
  loadInbox.mockResolvedValue([{ ...confirmed, mail_sent: false }])
  render(<AdminShell />)
  await userEvent.click(await screen.findByRole('button', { name: 'Afspraken' }))
  await userEvent.click(within(row('Kim Confirmed')).getByRole('button', { name: 'Opnieuw mailen' }))
  expect(screen.getByLabelText('Sjabloon')).toHaveValue('thanks')
  await waitFor(() => expect(screen.getByLabelText('Onderwerp')).toHaveValue('Je afspraak staat vast'))
  expect(screen.getByLabelText('Bericht')).toHaveValue('Hoi Kim Confirmed, Baard op dinsdag 6 oktober om 10:00.')
})

test('Ander tijdstip moves the booking, confirms it and reports the mail', async () => {
  moveBooking.mockResolvedValue({ ok: true, sent: true })
  loadInbox.mockResolvedValueOnce([pending]).mockResolvedValue([
    { ...pending, start: '2027-01-12T11:00:00', status: 'confirmed', mail_sent: true },
  ])
  render(<AdminShell />)
  await userEvent.click(await screen.findByRole('button', { name: 'Afspraken 1' }))
  await userEvent.click(within(row('Sam Pending')).getByRole('button', { name: 'Ander tijdstip' }))
  const form = screen.getByRole('form', { name: 'Sam Pending verplaatsen' })
  expect(within(form).getByLabelText('Nieuwe dag')).toHaveValue('2026-10-08')
  fireEvent.change(within(form).getByLabelText('Nieuwe dag'), { target: { value: '2027-01-12' } })
  fireEvent.change(within(form).getByLabelText('Tijd'), { target: { value: '11:00' } })
  await userEvent.click(within(form).getByRole('button', { name: 'Verplaats en mail' }))
  expect(moveBooking).toHaveBeenCalledWith('pend-1', '2027-01-12T11:00:00')
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Sam Pending staat nu op di 12 jan om 11:00. De klant heeft een mail gekregen.',
  )
  await waitFor(() => expect(within(row('Sam Pending')).getByText('Bevestigd')).toBeInTheDocument())
  expect(screen.getByText('Alles bij')).toBeInTheDocument()
})

test('moving onto a taken time explains it and keeps the form open', async () => {
  moveBooking.mockResolvedValue({ ok: false, error: 'overlap' })
  loadInbox.mockResolvedValue([pending])
  render(<AdminShell />)
  await userEvent.click(await screen.findByRole('button', { name: 'Afspraken 1' }))
  await userEvent.click(within(row('Sam Pending')).getByRole('button', { name: 'Ander tijdstip' }))
  await userEvent.click(screen.getByRole('button', { name: 'Verplaats en mail' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Die tijd is dicht of al bezet')
  expect(screen.getByRole('form', { name: 'Sam Pending verplaatsen' })).toBeInTheDocument()
})

test('the bon changes price and discount both ways, adds products and saves', async () => {
  saveOrder.mockResolvedValue({ ok: true })
  loadInbox.mockResolvedValue([{ ...confirmed, price: '€15' }])
  render(<AdminShell />)
  await userEvent.click(await screen.findByRole('button', { name: 'Afspraken' }))
  // The shell passes products and prices itself; the editor is driven through the card.
  await userEvent.click(within(row('Kim Confirmed')).getByRole('button', { name: 'Bon Kim Confirmed' }))
  const bon = screen.getByRole('form', { name: 'Bon Kim Confirmed' })
  const price = within(bon).getByLabelText('Prijs dienst')
  const discount = within(bon).getByLabelText('Korting dienst')
  expect(price).toHaveValue('15')
  expect(discount).toHaveValue('0')
  await userEvent.clear(price)
  await userEvent.type(price, '12,50')
  expect(discount).toHaveValue('2,50')
  await userEvent.clear(discount)
  await userEvent.type(discount, '5')
  expect(price).toHaveValue('10')
  expect(within(bon).getByTestId('order-total')).toHaveTextContent('€10')
  // Products: pick Wax twice (same line, quantity 2) and give it a discount.
  await userEvent.selectOptions(within(bon).getByLabelText('Product toevoegen'), 'p1')
  await userEvent.selectOptions(within(bon).getByLabelText('Product toevoegen'), 'p1')
  expect(within(bon).getByLabelText('Aantal Wax')).toHaveValue(2)
  await userEvent.clear(within(bon).getByLabelText('Korting Wax'))
  await userEvent.type(within(bon).getByLabelText('Korting Wax'), '2,50')
  expect(within(bon).getByLabelText('Prijs Wax')).toHaveValue('10')
  expect(within(bon).getByTestId('order-total')).toHaveTextContent('€30')
  await userEvent.click(within(bon).getByRole('button', { name: 'Bon opslaan' }))
  expect(saveOrder).toHaveBeenCalledWith('conf-1', {
    charged: 10,
    items: [{ productId: 'p1', name: 'Wax', listPrice: 12.5, price: 10, quantity: 2 }],
  })
  expect(await screen.findByRole('status')).toHaveTextContent('Bon van Kim Confirmed opgeslagen: €30.')
  const card = row('Kim Confirmed')
  expect(within(card).getByText('€30')).toHaveClass('is-money')
  expect(within(card).getByText('korting €10')).toBeInTheDocument()
  expect(within(card).getByText('2 producten')).toBeInTheDocument()
  expect(loadProducts).toHaveBeenCalledTimes(2)
})

test('a product that is out of stock warns on the bon', async () => {
  loadInbox.mockResolvedValue([confirmed])
  render(<AdminShell />)
  await userEvent.click(await screen.findByRole('button', { name: 'Afspraken' }))
  await userEvent.click(within(row('Kim Confirmed')).getByRole('button', { name: 'Bon Kim Confirmed' }))
  const bon = screen.getByRole('form', { name: 'Bon Kim Confirmed' })
  await userEvent.selectOptions(within(bon).getByLabelText('Product toevoegen'), 'p2')
  expect(within(bon).getByText('niet genoeg op voorraad')).toBeInTheDocument()
})

const PAST = {
  ...confirmed,
  id: 'past-1',
  name: 'Piet Geweest',
  email: 'piet@mail.nl',
  phone: '06 11122233',
  start: '2026-10-02T11:00:00',
  minutes: 45,
}
const OLD_REQUEST = { ...pending, id: 'pend-old', name: 'Olga Verlopen', email: 'olga@mail.nl', start: '2026-10-03T10:00:00' }
const DECLINED = { ...confirmed, id: 'decl-1', name: 'Dirk Geweigerd', email: 'dirk@mail.nl', status: 'declined' as const, start: '2026-10-09T10:00:00' }

test('the list opens on what is coming; past appointments are one tap away and clearly marked', async () => {
  loadInbox.mockResolvedValue([confirmed, pending, PAST, DECLINED])
  render(<AdminShell />)
  await userEvent.click(await screen.findByRole('button', { name: 'Afspraken 1' }))
  expect(screen.getByRole('radio', { name: 'Komend 3' })).toHaveAttribute('aria-checked', 'true')
  expect(screen.getByText('Kim Confirmed')).toBeInTheDocument()
  expect(screen.getByText('Sam Pending')).toBeInTheDocument()
  expect(screen.queryByText('Piet Geweest')).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('radio', { name: 'Geweest 1' }))
  const past = row('Piet Geweest')
  expect(past).toHaveClass('is-over')
  expect(within(past).getByText('Geweest')).toBeInTheDocument()
  expect(within(past).queryByRole('button', { name: 'Ander tijdstip' })).not.toBeInTheDocument()
  expect(screen.queryByText('Kim Confirmed')).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('radio', { name: 'Alles 4' }))
  expect(screen.getAllByRole('listitem')).toHaveLength(4)
  expect(row('Kim Confirmed')).not.toHaveClass('is-over')
})

test('status, service and search narrow the list and Filters wissen brings it all back', async () => {
  loadInbox.mockResolvedValue([confirmed, pending, DECLINED])
  render(<AdminShell />)
  await userEvent.click(await screen.findByRole('button', { name: 'Afspraken 1' }))
  await userEvent.selectOptions(screen.getByLabelText('Status'), 'confirmed')
  expect(screen.getByText('Kim Confirmed')).toBeInTheDocument()
  expect(screen.queryByText('Sam Pending')).not.toBeInTheDocument()
  expect(screen.queryByText('Dirk Geweigerd')).not.toBeInTheDocument()

  await userEvent.selectOptions(screen.getByLabelText('Status'), '')
  await userEvent.selectOptions(screen.getByLabelText('Dienst'), 'cut')
  expect(screen.getByText('Sam Pending')).toBeInTheDocument()
  expect(screen.queryByText('Kim Confirmed')).not.toBeInTheDocument()

  await userEvent.selectOptions(screen.getByLabelText('Dienst'), '')
  await userEvent.type(screen.getByLabelText('Zoeken'), 'dirk')
  expect(screen.getByText('Dirk Geweigerd')).toBeInTheDocument()
  expect(screen.queryByText('Kim Confirmed')).not.toBeInTheDocument()

  await userEvent.clear(screen.getByLabelText('Zoeken'))
  await userEvent.type(screen.getByLabelText('Zoeken'), 'niemand')
  expect(screen.getByText(/Geen afspraken bij deze filters/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Filters wissen' }))
  expect(screen.getByLabelText('Zoeken')).toHaveValue('')
  expect(screen.getAllByRole('listitem')).toHaveLength(3)
})

test('the new-count button shows only what still needs a decision', async () => {
  loadInbox.mockResolvedValue([confirmed, pending, PAST])
  render(<AdminShell />)
  await userEvent.click(await screen.findByRole('button', { name: 'Afspraken 1' }))
  await userEvent.click(screen.getByRole('button', { name: '1 nieuw' }))
  expect(screen.getByLabelText('Status')).toHaveValue('pending')
  expect(screen.getAllByRole('listitem')).toHaveLength(1)
  expect(screen.getByText('Sam Pending')).toBeInTheDocument()
})

test('a request whose time has passed reads Verlopen and can only be declined', async () => {
  loadInbox.mockResolvedValue([OLD_REQUEST])
  render(<AdminShell />)
  await userEvent.click(await screen.findByRole('button', { name: 'Afspraken 1' }))
  await userEvent.click(screen.getByRole('radio', { name: 'Geweest 1' }))
  const old = row('Olga Verlopen')
  expect(within(old).getByText('Verlopen')).toBeInTheDocument()
  expect(within(old).queryByRole('button', { name: 'Accepteer' })).not.toBeInTheDocument()
  expect(within(old).getByRole('button', { name: 'Weiger' })).toBeInTheDocument()
})

test('an appointment in the chair right now says so', async () => {
  vi.setSystemTime(new Date('2026-10-06T10:10:00'))
  loadInbox.mockResolvedValue([confirmed])
  render(<AdminShell />)
  await userEvent.click(await screen.findByRole('button', { name: 'Afspraken' }))
  const live = row('Kim Confirmed')
  expect(live).toHaveClass('is-now')
  expect(within(live).getByText('Nu bezig')).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: 'Vandaag 1' })).toBeInTheDocument()
})

test('a past appointment can be marked as not shown up, and back; a no-show reads as unpaid', async () => {
  loadInbox.mockResolvedValue([PAST])
  render(<AdminShell />)
  await userEvent.click(await screen.findByRole('button', { name: 'Afspraken' }))
  await userEvent.click(screen.getByRole('radio', { name: 'Geweest 1' }))
  const card = row('Piet Geweest')
  // The dashboard fetches the appointments again after deciding; the server now says no-show.
  loadInbox.mockResolvedValue([{ ...PAST, status: 'noshow' }])
  await userEvent.click(within(card).getByRole('button', { name: 'Piet Geweest niet gekomen' }))
  expect(decideInbox).toHaveBeenCalledWith('past-1', 'noshow')
  expect(await screen.findByRole('status')).toHaveTextContent('Gemarkeerd als niet gekomen')
  await waitFor(() => expect(within(row('Piet Geweest')).getByText('Niet gekomen')).toBeInTheDocument())
  expect(within(row('Piet Geweest')).getByText('niet betaald')).toBeInTheDocument()
  expect(within(row('Piet Geweest')).queryByRole('button', { name: 'Bon Piet Geweest' })).not.toBeInTheDocument()
  loadInbox.mockResolvedValue([PAST])
  await userEvent.click(within(row('Piet Geweest')).getByRole('button', { name: 'Piet Geweest toch gekomen' }))
  expect(decideInbox).toHaveBeenCalledWith('past-1', 'showed')
  await waitFor(() => expect(within(row('Piet Geweest')).getByText('Bevestigd')).toBeInTheDocument())
})

test('the bon opens as a popup and Escape closes it', async () => {
  loadInbox.mockResolvedValue([confirmed])
  render(<AdminShell />)
  await userEvent.click(await screen.findByRole('button', { name: 'Afspraken' }))
  await userEvent.click(within(row('Kim Confirmed')).getByRole('button', { name: 'Bon Kim Confirmed' }))
  const dialog = screen.getByRole('dialog', { name: 'Bon Kim Confirmed' })
  expect(within(dialog).getByRole('form', { name: 'Bon Kim Confirmed' })).toBeInTheDocument()
  expect(row('Kim Confirmed').contains(dialog)).toBe(false)
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('dialog', { name: 'Bon Kim Confirmed' })).not.toBeInTheDocument()
})

test('an appointment card opens a dialog to change the service or remove it', async () => {
  adminWrite.mockReset()
  adminWrite.mockResolvedValue({ ok: true })
  loadInbox.mockResolvedValue([confirmed])
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(<AdminShell />)
  await user.click(await screen.findByRole('button', { name: 'Afspraken' }))
  await user.click(within(row('Kim Confirmed')).getByRole('button', { name: 'Kim Confirmed wijzigen' }))
  const dialog = screen.getByRole('dialog', { name: 'Boeking' })
  expect(dialog).toHaveTextContent('di 6 okt · 10:00')
  loadInbox.mockResolvedValue([{ ...confirmed, service: 'cut', minutes: 45 }])
  await user.selectOptions(within(dialog).getByLabelText('Dienst'), 'cut')
  await user.click(within(dialog).getByRole('button', { name: 'Dienst opslaan' }))
  expect(adminWrite).toHaveBeenCalledWith({ type: 'bookingService', id: 'conf-1', service: 'cut' })
  expect(screen.getByRole('status')).toHaveTextContent('Dienst gewijzigd: Kim Confirmed, Knippen.')
  expect(within(row('Kim Confirmed')).getByText(/Knippen · 45 min/)).toBeInTheDocument()

  await user.click(within(row('Kim Confirmed')).getByRole('button', { name: 'Kim Confirmed wijzigen' }))
  await user.click(within(screen.getByRole('dialog', { name: 'Boeking' })).getByRole('button', { name: 'Afspraak verwijderen' }))
  loadInbox.mockResolvedValue([])
  await user.click(screen.getByRole('button', { name: 'Echt verwijderen' }))
  expect(adminWrite).toHaveBeenCalledWith({ type: 'bookingDelete', id: 'conf-1' })
  expect(screen.getByRole('status')).toHaveTextContent('Afspraak verwijderd: Kim Confirmed')
  await waitFor(() => expect(screen.queryByText('Kim Confirmed')).not.toBeInTheDocument())
})

test('appointments that happened show whether they were paid, and can be marked paid', async () => {
  adminWrite.mockReset()
  adminWrite.mockResolvedValue({ ok: true })
  vi.setSystemTime(new Date('2026-10-07T12:00:00'))
  const done = { ...confirmed, id: 'done-1', name: 'Pia Paid', paid: true }
  const open = { ...confirmed, id: 'open-1', name: 'Olaf Open', start: '2026-10-06T11:00:00', paid: false }
  loadInbox.mockResolvedValue([done, open])
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(<AdminShell />)
  await user.click(await screen.findByRole('button', { name: 'Afspraken' }))
  await user.click(screen.getByRole('radio', { name: /Geweest/ }))
  expect(within(row('Pia Paid')).getByText('Betaald')).toBeInTheDocument()
  expect(within(row('Pia Paid')).queryByRole('button', { name: 'Pia Paid betaald' })).not.toBeInTheDocument()
  expect(within(row('Olaf Open')).getByText('Nog niet betaald')).toBeInTheDocument()

  // The filter narrows to who still has to pay.
  await user.selectOptions(screen.getByLabelText('Status'), 'unpaid')
  expect(screen.queryByText('Pia Paid')).not.toBeInTheDocument()

  loadInbox.mockResolvedValue([done, { ...open, paid: true }])
  await user.click(within(row('Olaf Open')).getByRole('button', { name: 'Olaf Open betaald' }))
  expect(adminWrite).toHaveBeenCalledWith({ type: 'bookingPaid', id: 'open-1', paid: true })
  expect(screen.getByRole('status')).toHaveTextContent('Olaf Open heeft betaald')
})

test('the Bon can mark the appointment paid when it is saved', async () => {
  vi.setSystemTime(new Date('2026-10-07T12:00:00'))
  saveOrder.mockResolvedValue({ ok: true })
  loadInbox.mockResolvedValue([{ ...confirmed, paid: false }])
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(<AdminShell />)
  await user.click(await screen.findByRole('button', { name: 'Afspraken' }))
  await user.click(screen.getByRole('radio', { name: /Geweest/ }))
  await user.click(screen.getByRole('button', { name: 'Bon Kim Confirmed' }))
  const paid = screen.getByLabelText(/Klant heeft betaald/)
  expect(paid).not.toBeChecked()
  await user.click(paid)
  await user.click(screen.getByRole('button', { name: 'Bon opslaan' }))
  expect(saveOrder).toHaveBeenCalledWith('conf-1', expect.objectContaining({ paid: true }))
  expect(screen.getByRole('status')).toHaveTextContent('betaald.')
})

test('without payment tracking there are no paid marks', async () => {
  vi.setSystemTime(new Date('2026-10-07T12:00:00'))
  loadInbox.mockResolvedValue([confirmed])
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(<AdminShell />)
  await user.click(await screen.findByRole('button', { name: 'Afspraken' }))
  await user.click(screen.getByRole('radio', { name: /Geweest/ }))
  expect(within(row('Kim Confirmed')).queryByText('Nog niet betaald')).not.toBeInTheDocument()
  expect(within(row('Kim Confirmed')).queryByRole('button', { name: 'Kim Confirmed betaald' })).not.toBeInTheDocument()
  expect(screen.queryByRole('option', { name: 'Nog niet betaald' })).not.toBeInTheDocument()
})
