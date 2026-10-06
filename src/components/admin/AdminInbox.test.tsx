import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { defaultSchedule } from '../../schedule'
import { AdminShell } from './AdminShell'

const { loadInbox, decideInbox, loadPublicSchedule, moveBooking, loadTemplates } = vi.hoisted(() => ({
  loadInbox: vi.fn(),
  decideInbox: vi.fn(),
  loadPublicSchedule: vi.fn(),
  moveBooking: vi.fn(),
  loadTemplates: vi.fn(),
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
  }
})

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
}

function row(name: string) {
  const item = screen.getByText(name).closest('li')
  if (!item) throw new Error(`missing row ${name}`)
  return item
}

beforeEach(() => {
  loadInbox.mockReset()
  decideInbox.mockReset()
  loadPublicSchedule.mockReset()
  decideInbox.mockResolvedValue({ ok: true })
  loadPublicSchedule.mockResolvedValue(defaultSchedule)
  moveBooking.mockReset()
  loadTemplates.mockReset()
  loadTemplates.mockResolvedValue([])
})

test('pending rows offer accept and decline and the badge counts them', async () => {
  loadInbox.mockResolvedValue([confirmed, pending])
  render(<AdminShell />)
  await userEvent.click(await screen.findByRole('button', { name: 'Inbox 1' }))

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
  await userEvent.click(await screen.findByRole('button', { name: 'Inbox 2' }))
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
  await userEvent.click(await screen.findByRole('button', { name: 'Inbox 1' }))
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
  await userEvent.click(await screen.findByRole('button', { name: 'Inbox 1' }))
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
  await userEvent.click(await screen.findByRole('button', { name: 'Inbox 1' }))
  await userEvent.click(within(row('Sam Pending')).getByRole('button', { name: 'Weiger' }))
  expect(decideInbox).toHaveBeenCalledWith('pend-1', 'decline')
})

test('a failed inbox load shows an error and no fake clients', async () => {
  loadInbox.mockRejectedValue(new Error('permission denied'))
  render(<AdminShell />)
  await userEvent.click(screen.getByRole('button', { name: /Inbox/ }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Inbox laden mislukt.')
  expect(screen.queryByText('Jan de Vries')).not.toBeInTheDocument()
})

test('an empty inbox says so', async () => {
  loadInbox.mockResolvedValue([])
  render(<AdminShell />)
  await userEvent.click(screen.getByRole('button', { name: /Inbox/ }))
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
  await userEvent.click(await screen.findByRole('button', { name: 'Inbox 1' }))
  await userEvent.click(within(row('Sam Pending')).getByRole('button', { name: 'Accepteer' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Die tijd is al bezet')
  expect(within(row('Sam Pending')).getByRole('button', { name: 'Accepteer' })).toBeInTheDocument()
})

test('unsent mail offers a resend that opens Mail for that client', async () => {
  loadInbox.mockResolvedValue([{ ...confirmed, mail_sent: false }])
  render(<AdminShell />)
  await userEvent.click(await screen.findByRole('button', { name: 'Inbox' }))
  const card = row('Kim Confirmed')
  expect(within(card).getByText('Mail niet gegaan')).toBeInTheDocument()
  await userEvent.click(within(card).getByRole('button', { name: 'Opnieuw mailen' }))
  expect(screen.getByRole('button', { name: 'Mail' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByLabelText('Klant')).toHaveValue('conf-1')
})

test('a pending request is not flagged as unsent mail and sits under Te beoordelen', async () => {
  loadInbox.mockResolvedValue([pending, confirmed])
  render(<AdminShell />)
  await userEvent.click(await screen.findByRole('button', { name: 'Inbox 1' }))
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
  await userEvent.click(await screen.findByRole('button', { name: 'Inbox' }))
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
  await userEvent.click(await screen.findByRole('button', { name: 'Inbox 1' }))
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
  await userEvent.click(await screen.findByRole('button', { name: 'Inbox 1' }))
  await userEvent.click(within(row('Sam Pending')).getByRole('button', { name: 'Ander tijdstip' }))
  await userEvent.click(screen.getByRole('button', { name: 'Verplaats en mail' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Die tijd is al bezet')
  expect(screen.getByRole('form', { name: 'Sam Pending verplaatsen' })).toBeInTheDocument()
})
