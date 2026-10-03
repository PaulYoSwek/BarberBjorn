import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { weekHoursFromDays } from '../../planning'
import { readLiveSchedule } from '../../planning-api'
import { defaultSchedule, type Weekday } from '../../schedule'
import { AdminPage } from '../../pages/AdminPage'
import { AdminShell } from './AdminShell'

const { adminWrite, loadPublicSchedule } = vi.hoisted(() => ({
  adminWrite: vi.fn(),
  loadPublicSchedule: vi.fn(),
}))

vi.mock('../../planning-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../planning-api')>()
  return {
    ...actual,
    adminWrite,
    loadPublicSchedule,
  }
})

const weekdays: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  adminWrite.mockReset()
  adminWrite.mockResolvedValue({ ok: true })
  loadPublicSchedule.mockReset()
  loadPublicSchedule.mockResolvedValue(defaultSchedule)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-05T08:00:00'))
})

afterEach(() => {
  vi.useRealTimers()
})

test('a stored session shows the week and a 12:00 chip writes that block', async () => {
  sessionStorage.setItem('barber-admin', '1')
  render(<AdminPage />)
  expect(screen.getByRole('button', { name: 'Kopieer naar aankomende weken' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /di 6 okt 09:00 vrij/ })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'ma 5 okt 12:00 vrij' }))
  expect(adminWrite).toHaveBeenCalledWith({
    type: 'blocks',
    date: '2026-10-05',
    time: '12:00',
    on: true,
  })
  expect(readLiveSchedule().blocks).toContainEqual({ date: '2026-10-05', time: '12:00' })
})

test('15:00 and 18:00 can be closed on their own', async () => {
  sessionStorage.setItem('barber-admin', '1')
  render(<AdminPage />)
  await userEvent.click(screen.getByRole('button', { name: 'ma 5 okt 15:00 vrij' }))
  expect(adminWrite).toHaveBeenCalledWith({
    type: 'blocks',
    date: '2026-10-05',
    time: '15:00',
    on: true,
  })
  await userEvent.click(screen.getByRole('button', { name: 'ma 5 okt 18:00 vrij' }))
  expect(adminWrite).toHaveBeenCalledWith({
    type: 'blocks',
    date: '2026-10-05',
    time: '18:00',
    on: true,
  })
})

test('a booked slot shows the client and does not write a block', async () => {
  sessionStorage.setItem('barber-admin', '1')
  render(<AdminPage />)
  const slot = screen.getByRole('button', { name: 'ma 5 okt 10:00 geboekt Jan de Vries' })
  await userEvent.click(slot)
  expect(adminWrite).not.toHaveBeenCalled()
  const dialog = screen.getByRole('dialog', { name: 'Boeking' })
  expect(dialog).toHaveTextContent('Jan de Vries')
  expect(dialog).toHaveTextContent('jan@example.com')
  expect(dialog).toHaveTextContent('06 12345678')
  expect(dialog).toHaveTextContent('Knippen')
  await userEvent.click(screen.getByRole('button', { name: 'Sluiten' }))
  expect(screen.queryByRole('dialog', { name: 'Boeking' })).not.toBeInTheDocument()
})

test('a late schedule load keeps a 12:00 block written this session', async () => {
  let resolveLoad: (schedule: typeof defaultSchedule) => void = () => {}
  loadPublicSchedule.mockReturnValue(
    new Promise((resolve) => {
      resolveLoad = resolve
    }),
  )
  sessionStorage.setItem('barber-admin', '1')
  render(<AdminPage />)
  const chip = screen.getByRole('button', { name: 'ma 5 okt 12:00 vrij' })
  await userEvent.click(chip)
  expect(adminWrite).toHaveBeenCalledWith({
    type: 'blocks',
    date: '2026-10-05',
    time: '12:00',
    on: true,
  })
  expect(chip).toHaveAttribute('aria-pressed', 'true')
  await act(async () => {
    resolveLoad({ ...defaultSchedule, blocks: [] })
  })
  expect(screen.getByRole('button', { name: 'ma 5 okt 12:00 dicht' })).toHaveAttribute('aria-pressed', 'true')
})

function editedWeek(open = '10:00') {
  return weekHoursFromDays(
    weekdays.map((weekday) => ({
      weekday,
      hours: weekday === 'mon' ? { open, close: '18:00' } : defaultSchedule.week[weekday],
    })),
  )
}

test('Toepassen stays disabled until the schedule load resolves', async () => {
  let resolveLoad: (schedule: typeof defaultSchedule) => void = () => {}
  loadPublicSchedule.mockReturnValue(
    new Promise((resolve) => {
      resolveLoad = resolve
    }),
  )
  sessionStorage.setItem('barber-admin', '1')
  render(<AdminPage />)
  const apply = screen.getByRole('button', { name: 'Kopieer naar aankomende weken' })
  expect(apply).toBeDisabled()
  await act(async () => {
    resolveLoad(defaultSchedule)
  })
  expect(apply).toBeEnabled()
})

test('hour edits before the schedule loads yield to the loaded weekday hours', async () => {
  let resolveLoad: (schedule: typeof defaultSchedule) => void = () => {}
  loadPublicSchedule.mockReturnValue(
    new Promise((resolve) => {
      resolveLoad = resolve
    }),
  )
  sessionStorage.setItem('barber-admin', '1')
  render(<AdminPage />)
  const open = screen.getByLabelText('Open')
  const close = screen.getByLabelText('Sluit')
  const shut = screen.getByRole('button', { name: 'ma 5 okt hele dag dicht' })
  expect(open).toBeDisabled()
  expect(close).toBeDisabled()
  expect(shut).toBeDisabled()
  fireEvent.change(open, { target: { value: '10:00' } })
  await userEvent.click(shut)
  const loaded = {
    ...defaultSchedule,
    week: {
      ...defaultSchedule.week,
      mon: { open: '11:00', close: '17:00' },
    },
  }
  await act(async () => {
    resolveLoad(loaded)
  })
  expect(screen.getByLabelText('Open')).toHaveValue('11:00')
  expect(screen.getByLabelText('Sluit')).toHaveValue('17:00')
  expect(screen.getByRole('button', { name: 'ma 5 okt hele dag dicht' })).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByRole('button', { name: /ma 5 okt 11:00–17:00/ })).toHaveTextContent(/11:00.17:00/)
  await userEvent.click(screen.getByRole('button', { name: 'Kopieer naar aankomende weken' }))
  expect(adminWrite).toHaveBeenCalledWith({ type: 'week', week: loaded.week })
})

test('a failed schedule load keeps Toepassen disabled and shows an error', async () => {
  loadPublicSchedule.mockRejectedValue(new Error('offline'))
  sessionStorage.setItem('barber-admin', '1')
  render(<AdminPage />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Agenda laden mislukt.')
  expect(screen.getByRole('button', { name: 'Kopieer naar aankomende weken' })).toBeDisabled()
})

test('hour edits apply to every selected day', async () => {
  sessionStorage.setItem('barber-admin', '1')
  render(<AdminPage />)
  const copyWeek = screen.getByRole('button', { name: 'Kopieer naar aankomende weken' })
  await waitFor(() => expect(copyWeek).toBeEnabled())
  await userEvent.click(screen.getByRole('button', { name: /di 6 okt 09:00–18:00/ }))
  expect(screen.getByRole('button', { name: /ma 5 okt 09:00–18:00/ })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: /di 6 okt 09:00–18:00/ })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.change(screen.getByLabelText('Open'), { target: { value: '10:00' } })
  expect(screen.queryByRole('button', { name: 'ma 5 okt 09:00 vrij' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'di 6 okt 09:00 vrij' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'do 8 okt 09:00 vrij' })).toBeInTheDocument()
})

test('changing open hours drops earlier slots on that day only', async () => {
  sessionStorage.setItem('barber-admin', '1')
  render(<AdminPage />)
  const apply = screen.getByRole('button', { name: 'Kopieer naar aankomende weken' })
  await waitFor(() => expect(apply).toBeEnabled())
  expect(screen.getByRole('button', { name: 'ma 5 okt 09:00 vrij' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'di 6 okt 09:00 vrij' })).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Open'), { target: { value: '10:00' } })
  expect(screen.queryByRole('button', { name: 'ma 5 okt 09:00 vrij' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'ma 5 okt 10:00 geboekt Jan de Vries' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'di 6 okt 09:00 vrij' })).toBeInTheDocument()
})

test('Kopieer naar aankomende weken writes the edited weekday hours', async () => {
  sessionStorage.setItem('barber-admin', '1')
  render(<AdminPage />)
  const apply = screen.getByRole('button', { name: 'Kopieer naar aankomende weken' })
  await waitFor(() => expect(apply).toBeEnabled())
  fireEvent.change(screen.getByLabelText('Open'), { target: { value: '10:00' } })
  await userEvent.click(apply)
  expect(adminWrite).toHaveBeenCalledWith({ type: 'week', week: editedWeek() })
  await act(async () => {
    await adminWrite.mock.results.at(-1)?.value
  })
  await userEvent.click(screen.getByRole('button', { name: 'Volgende week' }))
  expect(screen.getByLabelText('Open')).toHaveValue('10:00')
  await userEvent.click(screen.getByRole('button', { name: 'Kopieer naar aankomende weken' }))
  expect(adminWrite).toHaveBeenLastCalledWith({ type: 'week', week: editedWeek() })
})

test('each day column can close the whole day', async () => {
  sessionStorage.setItem('barber-admin', '1')
  render(<AdminPage />)
  const apply = screen.getByRole('button', { name: 'Kopieer naar aankomende weken' })
  await waitFor(() => expect(apply).toBeEnabled())
  expect(screen.queryByRole('checkbox', { name: 'Hele dag dicht' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'ma 5 okt hele dag dicht' }))
  expect(screen.queryByRole('button', { name: 'ma 5 okt 12:00 vrij' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /ma 5 okt dicht/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'ma 5 okt hele dag dicht' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'di 6 okt 09:00 vrij' })).toBeInTheDocument()
  expect(readLiveSchedule().blocks).toContainEqual({ date: '2026-10-05' })
  await userEvent.click(screen.getByRole('button', { name: 'Volgende week' }))
  expect(screen.getByRole('button', { name: /ma 12 okt 09:00–18:00/ })).toBeInTheDocument()
})

test('Kopieer naar aankomende weken copies a manually closed day', async () => {
  sessionStorage.setItem('barber-admin', '1')
  render(<AdminPage />)
  const apply = screen.getByRole('button', { name: 'Kopieer naar aankomende weken' })
  await waitFor(() => expect(apply).toBeEnabled())
  await userEvent.click(screen.getByRole('button', { name: 'wo 7 okt hele dag dicht' }))
  await userEvent.click(apply)
  expect(readLiveSchedule().week?.wed).toEqual({ closed: true })
  expect(readLiveSchedule().blocks).toEqual(
    expect.arrayContaining([{ date: '2026-10-07' }, { date: '2026-10-14' }, { date: '2026-10-21' }]),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Volgende week' }))
  expect(screen.getByRole('button', { name: /wo 14 okt dicht/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'wo 14 okt hele dag dicht' })).toHaveAttribute('aria-pressed', 'true')
})

test('a failed apply still keeps the edited hours on later weeks', async () => {
  adminWrite.mockResolvedValue({ ok: false, error: 'offline' })
  sessionStorage.setItem('barber-admin', '1')
  render(<AdminPage />)
  const apply = screen.getByRole('button', { name: 'Kopieer naar aankomende weken' })
  await waitFor(() => expect(apply).toBeEnabled())
  fireEvent.change(screen.getByLabelText('Open'), { target: { value: '10:00' } })
  await userEvent.click(apply)
  expect(adminWrite).toHaveBeenCalledWith({ type: 'week', week: editedWeek() })
  expect(await screen.findByRole('alert')).toHaveTextContent('Lokaal opgeslagen')
  expect(screen.getByLabelText('Open')).toHaveValue('10:00')
  await userEvent.click(screen.getByRole('button', { name: 'Volgende week' }))
  expect(screen.getByLabelText('Open')).toHaveValue('10:00')
})

test('a failed cloud write still keeps the slot closed', async () => {
  adminWrite.mockResolvedValue({ ok: false, error: 'offline' })
  sessionStorage.setItem('barber-admin', '1')
  render(<AdminPage />)
  await userEvent.click(screen.getByRole('button', { name: 'ma 5 okt 15:00 vrij' }))
  expect(screen.getByRole('button', { name: 'ma 5 okt 15:00 dicht' })).toHaveAttribute('aria-pressed', 'true')
  expect(await screen.findByRole('alert')).toHaveTextContent('Lokaal dichtgezet')
})

test('day columns page a week with Sunday last and a booked half-hour stays booked', async () => {
  sessionStorage.setItem('barber-admin', '1')
  render(<AdminPage />)
  expect(screen.getByRole('button', { name: /ma 5 okt 09:00–18:00/ })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'za 10 okt dicht' })).toHaveTextContent('dicht')
  expect(screen.getByRole('button', { name: 'zo 11 okt dicht' })).toHaveTextContent('dicht')
  expect(readLiveSchedule().bookings).toEqual(
    expect.arrayContaining([{ start: '2026-10-05T10:00:00', minutes: 45 }]),
  )
  expect(screen.getByRole('button', { name: 'Vorige week' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'ma 5 okt 10:00 geboekt Jan de Vries' })).toBeEnabled()
  await userEvent.click(screen.getByRole('button', { name: 'Volgende week' }))
  expect(screen.getByRole('button', { name: /ma 12 okt 09:00–18:00/ })).toBeInTheDocument()
})

test('shell marks the active tab at the top and shows the inbox badge', async () => {
  const { container } = render(<AdminShell pending={2} />)
  expect(container.querySelector('.admin-bar')).toBe(container.querySelector('.admin')?.firstElementChild)
  expect(screen.getByRole('img', { name: 'BarberBjorn' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Agenda' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('button', { name: 'Inbox 2' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Mail' }))
  expect(screen.getByRole('button', { name: 'Mail' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('button', { name: 'Agenda' })).not.toHaveAttribute('aria-current')
  expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Kopieer naar aankomende weken' })).not.toBeInTheDocument()
})
