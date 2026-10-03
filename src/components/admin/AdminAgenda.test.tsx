import { render, screen, fireEvent } from '@testing-library/react'
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

test('Toepassen op komende weken writes the edited weekday hours', async () => {
  sessionStorage.setItem('barber-admin', '1')
  render(<AdminPage />)
  fireEvent.change(screen.getByLabelText('Open'), { target: { value: '10:00' } })
  await userEvent.click(screen.getByRole('button', { name: 'Toepassen op komende weken' }))
  expect(adminWrite).toHaveBeenCalledWith({
    type: 'week',
    week: weekHoursFromDays(
      weekdays.map((weekday) => ({
        weekday,
        hours: weekday === 'mon' ? { open: '10:00', close: '18:00' } : defaultSchedule.week[weekday],
      })),
    ),
  })
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
