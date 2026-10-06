import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { defaultSchedule } from '../../schedule'
import { AdminShell } from './AdminShell'

const { loadInbox, loadClients, saveClient, loadServices, loadPublicSchedule, deleteClient } = vi.hoisted(() => ({
  deleteClient: vi.fn(),
  loadInbox: vi.fn(),
  loadClients: vi.fn(),
  saveClient: vi.fn(),
  loadServices: vi.fn(),
  loadPublicSchedule: vi.fn(),
}))

vi.mock('../../planning-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../planning-api')>()
  return { ...actual, loadInbox, loadClients, saveClient, loadServices, loadPublicSchedule, deleteClient }
})

function row(id: string, name: string, email: string, start: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    service: 'cut' as const,
    name,
    email,
    phone: '',
    start,
    minutes: 45,
    kind: 'slot' as const,
    status: 'confirmed' as const,
    lang: 'nl' as const,
    mail_sent: true,
    price: null,
    ...extra,
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-20T12:00:00'))
  loadInbox.mockReset()
  loadInbox.mockResolvedValue([
    row('1', 'Ada Vos', 'ada@x.nl', '2026-10-05T09:00:00'),
    row('2', 'Ada Vos', 'ada@x.nl', '2026-10-12T09:30:00', { service: 'both', price: '€45' }),
    row('3', 'Bo Kers', 'bo@x.nl', '2026-10-09T18:00:00', { service: 'beard' }),
  ])
  loadClients.mockReset()
  loadClients.mockResolvedValue({
    ready: true,
    clients: [
      { id: 'c1', name: 'Ada Vos', email: 'ada@x.nl', phone: '0611111111', note: 'Kort opzij', created_at: '2026-09-01T10:00:00Z' },
      { id: 'c2', name: 'Cas Nieuw', email: 'cas@x.nl', phone: '', note: '', created_at: '2026-10-19T10:00:00Z' },
    ],
  })
  saveClient.mockReset()
  deleteClient.mockReset()
  deleteClient.mockResolvedValue({ ok: true })
  saveClient.mockResolvedValue({ ok: true })
  loadServices.mockReset()
  loadServices.mockResolvedValue([
    { id: 'cut', price: '€30', minutes: 45 },
    { id: 'beard', price: '€15', minutes: 20 },
    { id: 'both', price: '€40', minutes: 60 },
  ])
  loadPublicSchedule.mockReset()
  loadPublicSchedule.mockResolvedValue(defaultSchedule)
})

afterEach(() => {
  vi.useRealTimers()
})

function card(name: string) {
  const item = screen.getByRole('heading', { name }).closest('li')
  if (!item) throw new Error(`missing card ${name}`)
  return item
}

async function openClients() {
  render(<AdminShell />)
  await userEvent.click(screen.getByRole('button', { name: 'Klanten' }))
  await screen.findByRole('heading', { name: 'Ada Vos' })
}

test('lists stored clients and everyone who booked, with visits, paid and usual time', async () => {
  await openClients()
  const ada = card('Ada Vos')
  expect(ada).toHaveTextContent('2×')
  expect(ada).toHaveTextContent('€75')
  expect(ada).toHaveTextContent('ma · ochtend')
  expect(ada).toHaveTextContent('Kort opzij')
  expect(within(ada).getByRole('link', { name: '0611111111' })).toHaveAttribute('href', 'tel:0611111111')
  expect(card('Bo Kers')).toHaveTextContent('€15')
  expect(card('Bo Kers')).toHaveTextContent('vr · avond')
  expect(card('Cas Nieuw')).toHaveTextContent('0×')
  expect(screen.getByText('3 klanten')).toBeInTheDocument()
  // Most visits first.
  const headings = screen.getAllByRole('heading', { level: 2 }).map((item) => item.textContent)
  expect(headings).toEqual(['Ada Vos', 'Bo Kers', 'Cas Nieuw'])
})

test('filters narrow the list and can be cleared', async () => {
  await openClients()
  await userEvent.selectOptions(screen.getByLabelText('Vaste dag'), 'fri')
  expect(screen.getByText('1 van 3 klanten')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Ada Vos' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Filters wissen' }))
  await userEvent.selectOptions(screen.getByLabelText('Betaald'), '50')
  expect(screen.getByText('1 van 3 klanten')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Ada Vos' })).toBeInTheDocument()
  await userEvent.selectOptions(screen.getByLabelText('Betaald'), '0')
  await userEvent.selectOptions(screen.getByLabelText('Laatst geweest'), 'never')
  expect(screen.getByRole('heading', { name: 'Cas Nieuw' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Bo Kers' })).not.toBeInTheDocument()
  await userEvent.selectOptions(screen.getByLabelText('Laatst geweest'), '')
  await userEvent.type(screen.getByLabelText('Zoeken'), 'bo@')
  expect(screen.getByText('1 van 3 klanten')).toBeInTheDocument()
})

test('a new client is saved and confirmed', async () => {
  await openClients()
  await userEvent.click(screen.getByRole('button', { name: '+ Klant toevoegen' }))
  const form = screen.getByRole('form', { name: 'Klant toevoegen' })
  await userEvent.type(within(form).getByLabelText('Naam'), 'Dirk Smit')
  await userEvent.type(within(form).getByLabelText('E-mail'), 'dirk@x.nl')
  await userEvent.type(within(form).getByLabelText('Telefoon'), '0622222222')
  await userEvent.click(within(form).getByRole('button', { name: 'Opslaan' }))
  expect(saveClient).toHaveBeenCalledWith({ name: 'Dirk Smit', email: 'dirk@x.nl', phone: '0622222222', note: '' })
  expect(await screen.findByRole('status')).toHaveTextContent('Dirk Smit is toegevoegd.')
  await waitFor(() => expect(loadClients).toHaveBeenCalledTimes(2))
  expect(screen.queryByRole('form', { name: 'Klant toevoegen' })).not.toBeInTheDocument()
})

test('editing keeps the id and a duplicate mail address is explained', async () => {
  saveClient.mockResolvedValue({ ok: false, error: 'exists' })
  await openClients()
  await userEvent.click(screen.getByRole('button', { name: 'Ada Vos bewerken' }))
  const form = screen.getByRole('form', { name: 'Klant bewerken' })
  expect(within(form).getByLabelText('Naam')).toHaveValue('Ada Vos')
  await userEvent.clear(within(form).getByLabelText('Notitie'))
  await userEvent.type(within(form).getByLabelText('Notitie'), 'Altijd koffie')
  await userEvent.click(within(form).getByRole('button', { name: 'Opslaan' }))
  expect(saveClient).toHaveBeenCalledWith({
    id: 'c1',
    name: 'Ada Vos',
    email: 'ada@x.nl',
    phone: '0611111111',
    note: 'Altijd koffie',
  })
  expect(await screen.findByRole('alert')).toHaveTextContent('Er is al een klant met dit mailadres.')
})

test('without the clients table the page still shows people from bookings', async () => {
  loadClients.mockResolvedValue({ ready: false, clients: [] })
  await openClients()
  expect(screen.getByText(/klantenlijst in de database is nog niet actief/)).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Bo Kers' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Cas Nieuw' })).not.toBeInTheDocument()
})

test('a client and their bookings can be deleted after a clear confirmation', async () => {
  await openClients()
  await userEvent.click(screen.getByRole('button', { name: 'Ada Vos bewerken' }))
  await userEvent.click(screen.getByRole('button', { name: 'Klant en afspraken verwijderen' }))
  expect(screen.getByText(/Dit verwijdert Ada Vos en alle 2 afspraken voorgoed/)).toBeInTheDocument()
  expect(deleteClient).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Ja, verwijderen' }))
  expect(deleteClient).toHaveBeenCalledWith({ id: 'c1', email: 'ada@x.nl', phone: '0611111111' })
  expect(await screen.findByRole('status')).toHaveTextContent('Ada Vos en alle afspraken zijn verwijderd.')
  await waitFor(() => expect(loadInbox).toHaveBeenCalledTimes(2))
})
