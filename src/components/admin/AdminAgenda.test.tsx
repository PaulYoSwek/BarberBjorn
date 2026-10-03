import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { weekHoursFromDays } from '../../planning'
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

test('a stored session shows the agenda and a 12:00 chip writes that block', async () => {
  sessionStorage.setItem('barber-admin', '1')
  render(<AdminPage />)
  expect(screen.getByRole('button', { name: 'Toepassen op komende weken' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: '12:00' }))
  expect(adminWrite).toHaveBeenCalledWith({
    type: 'blocks',
    date: '2026-10-05',
    time: '12:00',
    on: true,
  })
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
  const chip = screen.getByRole('button', { name: '12:00' })
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
  expect(screen.getByRole('button', { name: '12:00' })).toHaveAttribute('aria-pressed', 'true')
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
  const apply = screen.getByRole('button', { name: 'Toepassen op komende weken' })
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
  const shut = screen.getByRole('checkbox', { name: 'Dicht' })
  expect(open).toBeDisabled()
  expect(close).toBeDisabled()
  expect(shut).toBeDisabled()
  fireEvent.change(open, { target: { value: '10:00' } })
  fireEvent.change(shut, { target: { checked: true } })
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
  expect(screen.getByRole('checkbox', { name: 'Dicht' })).not.toBeChecked()
  expect(screen.getByRole('button', { name: /ma 5 okt/ })).toHaveTextContent(/11:00.17:00/)
  await userEvent.click(screen.getByRole('button', { name: 'Toepassen op komende weken' }))
  expect(adminWrite).toHaveBeenCalledWith({ type: 'week', week: loaded.week })
})

test('a failed schedule load keeps Toepassen disabled and shows an error', async () => {
  loadPublicSchedule.mockRejectedValue(new Error('offline'))
  sessionStorage.setItem('barber-admin', '1')
  render(<AdminPage />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Agenda laden mislukt.')
  expect(screen.getByRole('button', { name: 'Toepassen op komende weken' })).toBeDisabled()
})

test('Toepassen op komende weken writes the edited weekday hours', async () => {
  sessionStorage.setItem('barber-admin', '1')
  render(<AdminPage />)
  const apply = screen.getByRole('button', { name: 'Toepassen op komende weken' })
  await waitFor(() => expect(apply).toBeEnabled())
  fireEvent.change(screen.getByLabelText('Open'), { target: { value: '10:00' } })
  await userEvent.click(apply)
  expect(adminWrite).toHaveBeenCalledWith({ type: 'week', week: editedWeek() })
  await act(async () => {
    await adminWrite.mock.results.at(-1)?.value
  })
  await userEvent.click(screen.getByRole('button', { name: 'Volgende week' }))
  expect(screen.getByLabelText('Open')).toHaveValue('10:00')
  await userEvent.click(screen.getByRole('button', { name: 'Toepassen op komende weken' }))
  expect(adminWrite).toHaveBeenLastCalledWith({ type: 'week', week: editedWeek() })
})

test('a failed apply shows an error and keeps the edited hours', async () => {
  adminWrite.mockResolvedValue({ ok: false, error: 'offline' })
  sessionStorage.setItem('barber-admin', '1')
  render(<AdminPage />)
  const apply = screen.getByRole('button', { name: 'Toepassen op komende weken' })
  await waitFor(() => expect(apply).toBeEnabled())
  fireEvent.change(screen.getByLabelText('Open'), { target: { value: '10:00' } })
  await userEvent.click(apply)
  expect(adminWrite).toHaveBeenCalledWith({ type: 'week', week: editedWeek() })
  expect(await screen.findByRole('alert')).toHaveTextContent('Uren opslaan mislukt.')
  expect(screen.getByLabelText('Open')).toHaveValue('10:00')
  await userEvent.click(screen.getByRole('button', { name: 'Volgende week' }))
  expect(screen.getByLabelText('Open')).toHaveValue('09:00')
})

test('day chips page a week and a booked half-hour stays shut', async () => {
  sessionStorage.setItem('barber-admin', '1')
  render(<AdminPage />)
  expect(screen.getByRole('button', { name: /ma 5 okt/ })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: /za 10 okt/ })).toHaveTextContent('dicht')
  expect(screen.getByRole('button', { name: 'Vorige week' })).toBeDisabled()
  expect(screen.getByRole('button', { name: '10:00' })).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: 'Volgende week' }))
  expect(screen.getByRole('button', { name: /ma 12 okt/ })).toBeInTheDocument()
})

test('shell marks the active tab and shows the inbox badge', async () => {
  render(<AdminShell pending={2} />)
  expect(screen.getByRole('button', { name: 'Agenda' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('button', { name: 'Inbox 2' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Mail' }))
  expect(screen.getByRole('button', { name: 'Mail' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('button', { name: 'Agenda' })).not.toHaveAttribute('aria-current')
  expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Toepassen op komende weken' })).not.toBeInTheDocument()
})
