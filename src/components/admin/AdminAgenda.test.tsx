import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { weekHoursFromDays } from '../../planning'
import { defaultSchedule, type Weekday } from '../../schedule'
import { AdminPage } from '../../pages/AdminPage'
import { AdminShell } from './AdminShell'
import { DEMO_INBOX, DEMO_SCHEDULE } from './demo'

const { adminWrite, loadPublicSchedule, loadInbox } = vi.hoisted(() => ({
  adminWrite: vi.fn(),
  loadPublicSchedule: vi.fn(),
  loadInbox: vi.fn(),
}))

vi.mock('../../planning-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../planning-api')>()
  return {
    ...actual,
    adminWrite,
    loadPublicSchedule,
    loadInbox,
  }
})

const weekdays: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const PAGE = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  adminWrite.mockReset()
  adminWrite.mockResolvedValue({ ok: true })
  loadPublicSchedule.mockReset()
  loadPublicSchedule.mockResolvedValue(DEMO_SCHEDULE)
  loadInbox.mockReset()
  loadInbox.mockResolvedValue(DEMO_INBOX)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-05T08:00:00'))
})

afterEach(() => {
  vi.useRealTimers()
})

async function openAdmin() {
  sessionStorage.setItem('barber-admin', '1')
  render(<AdminPage />)
  await screen.findByRole('button', { name: 'Kopieer naar aankomende weken' })
}

async function openReady() {
  await openAdmin()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Kopieer naar aankomende weken' })).toBeEnabled())
}

test('a stored session shows the week and a 12:00 chip writes that block', async () => {
  await openAdmin()
  expect(screen.getByRole('button', { name: /di 6 okt 09:00 vrij/ })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'ma 5 okt 12:00 vrij' }))
  expect(adminWrite).toHaveBeenCalledWith({
    type: 'blocks',
    date: '2026-10-05',
    time: '12:00',
    on: true,
  })
  expect(screen.getByRole('button', { name: 'ma 5 okt 12:00 dicht' })).toHaveAttribute('aria-pressed', 'true')
})

test('15:00 and 18:00 can be closed on their own', async () => {
  await openAdmin()
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
  await openAdmin()
  const slot = await screen.findByRole('button', { name: 'ma 5 okt 10:00 geboekt Jan de Vries' })
  await userEvent.click(slot)
  expect(adminWrite).not.toHaveBeenCalled()
  const dialog = screen.getByRole('dialog', { name: 'Boeking' })
  expect(dialog).toHaveTextContent('Jan de Vries')
  expect(dialog).toHaveTextContent('jan@example.com')
  expect(dialog).toHaveTextContent('06 12345678')
  expect(dialog).toHaveTextContent('Knippen · 45 min')
  await userEvent.click(screen.getByRole('button', { name: 'Sluiten' }))
  expect(screen.queryByRole('dialog', { name: 'Boeking' })).not.toBeInTheDocument()
})

test('an empty inbox shows no clients and no fake bookings', async () => {
  loadInbox.mockResolvedValue([])
  loadPublicSchedule.mockResolvedValue(defaultSchedule)
  await openReady()
  expect(screen.queryByRole('button', { name: /geboekt/ })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'ma 5 okt 10:00 vrij' })).toBeInTheDocument()
})

test('a late schedule load keeps a 12:00 block written this session', async () => {
  let resolveLoad: (schedule: typeof defaultSchedule) => void = () => {}
  loadPublicSchedule.mockReturnValue(
    new Promise((resolve) => {
      resolveLoad = resolve
    }),
  )
  await openAdmin()
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
    resolveLoad({ ...DEMO_SCHEDULE, blocks: [] })
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
  await openAdmin()
  const apply = screen.getByRole('button', { name: 'Kopieer naar aankomende weken' })
  expect(apply).toBeDisabled()
  expect(screen.getByText('Agenda laden…')).toBeInTheDocument()
  await act(async () => {
    resolveLoad(DEMO_SCHEDULE)
  })
  expect(apply).toBeEnabled()
  expect(screen.queryByText('Agenda laden…')).not.toBeInTheDocument()
})

test('hour edits before the schedule loads yield to the loaded weekday hours', async () => {
  let resolveLoad: (schedule: typeof defaultSchedule) => void = () => {}
  loadPublicSchedule.mockReturnValue(
    new Promise((resolve) => {
      resolveLoad = resolve
    }),
  )
  await openAdmin()
  const open = screen.getByLabelText('Open')
  const close = screen.getByLabelText('Sluit')
  const shut = screen.getByRole('button', { name: 'ma 5 okt hele dag dicht' })
  expect(open).toBeDisabled()
  expect(close).toBeDisabled()
  expect(shut).toBeDisabled()
  fireEvent.change(open, { target: { value: '10:00' } })
  await userEvent.click(shut)
  const loaded = {
    ...DEMO_SCHEDULE,
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
  expect(adminWrite).toHaveBeenCalledWith({ type: 'week', week: loaded.week, clearDates: PAGE })
})

test('loaded one-off hours show on that date only', async () => {
  loadPublicSchedule.mockResolvedValue({
    ...DEMO_SCHEDULE,
    exceptions: { '2026-10-06': { open: '12:00', close: '16:00' }, '2026-10-13': { closed: true } },
  })
  await openReady()
  expect(screen.getByRole('button', { name: /di 6 okt 12:00–16:00/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'di 6 okt 09:00 vrij' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Volgende week' }))
  expect(screen.getByRole('button', { name: /di 13 okt dicht/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /wo 14 okt 09:00–18:00/ })).toBeInTheDocument()
})

test('a failed schedule load keeps Toepassen disabled and shows an error', async () => {
  loadPublicSchedule.mockRejectedValue(new Error('offline'))
  await openAdmin()
  expect(await screen.findByRole('alert')).toHaveTextContent('Agenda laden mislukt.')
  expect(screen.getByRole('button', { name: 'Kopieer naar aankomende weken' })).toBeDisabled()
})

test('hour edits apply to every selected day as one-off hours', async () => {
  await openReady()
  await userEvent.click(screen.getByRole('button', { name: /di 6 okt 09:00–18:00/ }))
  expect(screen.getByRole('button', { name: /ma 5 okt 09:00–18:00/ })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: /di 6 okt 09:00–18:00/ })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.change(screen.getByLabelText('Open'), { target: { value: '10:00' } })
  expect(screen.queryByRole('button', { name: 'ma 5 okt 09:00 vrij' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'di 6 okt 09:00 vrij' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'do 8 okt 09:00 vrij' })).toBeInTheDocument()
  expect(adminWrite).toHaveBeenCalledWith({ type: 'exception', date: '2026-10-05', hours: { open: '10:00', close: '18:00' } })
  expect(adminWrite).toHaveBeenCalledWith({ type: 'exception', date: '2026-10-06', hours: { open: '10:00', close: '18:00' } })
  expect(adminWrite).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'week' }))
  // Next Monday keeps the template: the edit was one-off.
  await userEvent.click(screen.getByRole('button', { name: 'Volgende week' }))
  expect(screen.getByRole('button', { name: /ma 12 okt 09:00–18:00/ })).toBeInTheDocument()
})

test('changing open hours drops earlier slots on that day only', async () => {
  await openReady()
  expect(screen.getByRole('button', { name: 'ma 5 okt 09:00 vrij' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'di 6 okt 09:00 vrij' })).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Open'), { target: { value: '10:00' } })
  expect(screen.queryByRole('button', { name: 'ma 5 okt 09:00 vrij' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'ma 5 okt 10:00 geboekt Jan de Vries' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'di 6 okt 09:00 vrij' })).toBeInTheDocument()
})

test('Kopieer naar aankomende weken writes the edited weekday hours and clears the one-offs', async () => {
  await openReady()
  fireEvent.change(screen.getByLabelText('Open'), { target: { value: '10:00' } })
  await userEvent.click(screen.getByRole('button', { name: 'Kopieer naar aankomende weken' }))
  expect(adminWrite).toHaveBeenCalledWith({ type: 'week', week: editedWeek(), clearDates: PAGE })
  await act(async () => {
    await adminWrite.mock.results.at(-1)?.value
  })
  await userEvent.click(screen.getByRole('button', { name: 'Volgende week' }))
  expect(screen.getByLabelText('Open')).toHaveValue('10:00')
  await userEvent.click(screen.getByRole('button', { name: 'Kopieer naar aankomende weken' }))
  expect(adminWrite).toHaveBeenLastCalledWith({
    type: 'week',
    week: editedWeek(),
    clearDates: ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'],
  })
})

test('each day column can close the whole day', async () => {
  await openReady()
  await userEvent.click(screen.getByRole('button', { name: 'ma 5 okt hele dag dicht' }))
  expect(screen.queryByRole('button', { name: 'ma 5 okt 12:00 vrij' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /ma 5 okt dicht/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'ma 5 okt hele dag dicht' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'di 6 okt 09:00 vrij' })).toBeInTheDocument()
  expect(adminWrite).toHaveBeenCalledWith({ type: 'blocks', date: '2026-10-05', time: '', on: true })
  await userEvent.click(screen.getByRole('button', { name: 'Volgende week' }))
  expect(screen.getByRole('button', { name: /ma 12 okt 09:00–18:00/ })).toBeInTheDocument()
})

test('reopening a Saturday gives it hours for that date only', async () => {
  await openReady()
  await userEvent.click(screen.getByRole('button', { name: 'za 10 okt hele dag dicht' }))
  expect(screen.getByRole('button', { name: /za 10 okt 09:00–18:00/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'za 10 okt 09:00 vrij' })).toBeInTheDocument()
  await waitFor(() =>
    expect(adminWrite).toHaveBeenCalledWith({ type: 'exception', date: '2026-10-10', hours: { open: '09:00', close: '18:00' } }),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Volgende week' }))
  expect(screen.getByRole('button', { name: /za 17 okt dicht/ })).toBeInTheDocument()
})

test('Kopieer naar aankomende weken makes a closed day the template', async () => {
  await openReady()
  await userEvent.click(screen.getByRole('button', { name: 'wo 7 okt hele dag dicht' }))
  await userEvent.click(screen.getByRole('button', { name: 'Kopieer naar aankomende weken' }))
  const call = adminWrite.mock.calls.find((args) => args[0]?.type === 'week')?.[0] as { week: Record<Weekday, unknown> }
  expect(call.week.wed).toEqual({ closed: true })
  await userEvent.click(screen.getByRole('button', { name: 'Volgende week' }))
  expect(screen.getByRole('button', { name: /wo 14 okt dicht/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'wo 14 okt hele dag dicht' })).toHaveAttribute('aria-pressed', 'true')
})

test('a failed apply reverts the template and says so', async () => {
  await openReady()
  fireEvent.change(screen.getByLabelText('Open'), { target: { value: '10:00' } })
  await waitFor(() => expect(adminWrite).toHaveBeenCalledWith(expect.objectContaining({ type: 'exception' })))
  adminWrite.mockResolvedValue({ ok: false, error: 'offline' })
  await userEvent.click(screen.getByRole('button', { name: 'Kopieer naar aankomende weken' }))
  expect(adminWrite).toHaveBeenCalledWith({ type: 'week', week: editedWeek(), clearDates: PAGE })
  expect(await screen.findByRole('alert')).toHaveTextContent('Opslaan mislukt')
  // The one-off edit on Monday 5 stays; next Monday is back on the template.
  expect(screen.getByLabelText('Open')).toHaveValue('10:00')
  await userEvent.click(screen.getByRole('button', { name: 'Volgende week' }))
  expect(screen.getByLabelText('Open')).toHaveValue('09:00')
})

test('a failed cloud write reopens the slot and says so', async () => {
  adminWrite.mockResolvedValue({ ok: false, error: 'offline' })
  await openAdmin()
  await userEvent.click(screen.getByRole('button', { name: 'ma 5 okt 15:00 vrij' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Opslaan mislukt')
  expect(screen.getByRole('button', { name: 'ma 5 okt 15:00 vrij' })).toHaveAttribute('aria-pressed', 'false')
})

test('day columns page a week with Sunday last and a booked half-hour stays booked', async () => {
  await openAdmin()
  expect(screen.getByRole('button', { name: /ma 5 okt 09:00–18:00/ })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'za 10 okt dicht' })).toHaveTextContent('dicht')
  expect(screen.getByRole('button', { name: 'zo 11 okt dicht' })).toHaveTextContent('dicht')
  expect(screen.getByRole('button', { name: 'Vorige week' })).toBeDisabled()
  expect(await screen.findByRole('button', { name: 'ma 5 okt 10:00 geboekt Jan de Vries' })).toBeEnabled()
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
  expect(screen.getByRole('link', { name: 'Naar de website' })).toHaveAttribute('href', '/')
  expect(screen.queryByRole('button', { name: 'Kopieer naar aankomende weken' })).not.toBeInTheDocument()
})
