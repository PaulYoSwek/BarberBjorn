import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { defaultSchedule } from '../../schedule'
import { AdminShell } from './AdminShell'

const { loadInbox, decideInbox, loadPublicSchedule } = vi.hoisted(() => ({
  loadInbox: vi.fn(),
  decideInbox: vi.fn(),
  loadPublicSchedule: vi.fn(),
}))

vi.mock('../../planning-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../planning-api')>()
  return {
    ...actual,
    loadInbox,
    decideInbox,
    loadPublicSchedule,
  }
})

const pending = {
  id: 'pend-1',
  service: 'cut' as const,
  name: 'Sam Pending',
  email: 'sam@mail.nl',
  phone: '0612345678',
  start: '2026-10-08T14:00:00',
  kind: 'custom' as const,
  status: 'pending' as const,
  mail_sent: false,
}

const confirmed = {
  id: 'conf-1',
  service: 'beard' as const,
  name: 'Kim Confirmed',
  email: 'kim@mail.nl',
  phone: '',
  start: '2026-10-06T10:00:00',
  kind: 'slot' as const,
  status: 'confirmed' as const,
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

test('a failed inbox load falls back to demo bookings', async () => {
  loadInbox.mockRejectedValue(new Error('permission denied'))
  render(<AdminShell />)
  await userEvent.click(screen.getByRole('button', { name: /Inbox/ }))
  expect(await screen.findByText('Jan de Vries')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('unsent mail offers a resend that opens Mail for that client', async () => {
  loadInbox.mockResolvedValue([pending])
  render(<AdminShell />)
  await userEvent.click(await screen.findByRole('button', { name: 'Inbox 1' }))
  const pendingRow = row('Sam Pending')
  expect(within(pendingRow).getByText('Mail niet gegaan')).toBeInTheDocument()
  await userEvent.click(within(pendingRow).getByRole('button', { name: 'Opnieuw' }))
  expect(screen.getByRole('button', { name: 'Mail' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByLabelText('Klant')).toHaveValue('pend-1')
})
