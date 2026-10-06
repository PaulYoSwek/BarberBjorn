import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { LanguageProvider } from '../language'
import { publishLiveSchedule } from '../planning-api'
import { DEMO_SCHEDULE as defaultSchedule } from './admin/demo'
import { BookingForm } from './BookingForm'
import { LanguageSwitch } from './LanguageSwitch'

const { submitBook, submitCustom, loadServices, loadPublicSchedule } = vi.hoisted(() => ({
  submitBook: vi.fn(),
  submitCustom: vi.fn(),
  loadServices: vi.fn(),
  loadPublicSchedule: vi.fn(),
}))

vi.mock('../planning-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../planning-api')>()
  return {
    ...actual,
    submitBook,
    submitCustom,
    loadServices,
    loadPublicSchedule,
  }
})

beforeEach(() => {
  submitBook.mockReset()
  submitBook.mockResolvedValue({ ok: true })
  submitCustom.mockReset()
  submitCustom.mockResolvedValue({ ok: true })
  loadServices.mockReset()
  loadServices.mockResolvedValue([])
  loadPublicSchedule.mockReset()
  loadPublicSchedule.mockResolvedValue(defaultSchedule)
})

test('starts on knippen + baard and lets you pick a service', async () => {
  render(
    <LanguageProvider>
      <BookingForm />
    </LanguageProvider>,
  )
  expect(screen.queryByText('Allebei')).not.toBeInTheDocument()
  expect(screen.queryByText('Beide')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Knippen + baard' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Knippen' })).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByRole('button', { name: 'Baard' })).toHaveAttribute('aria-pressed', 'false')
  await userEvent.click(screen.getByRole('button', { name: 'Knippen' }))
  expect(screen.getByRole('button', { name: 'Knippen' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByTestId('booking-summary')).toHaveTextContent('Knippen')
})

test('shows the chosen service and time above send', async () => {
  window.history.replaceState(null, '', '/?lang=nl')
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-05T12:00:00'))
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  try {
    render(
      <LanguageProvider>
        <BookingForm />
      </LanguageProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'di 6 okt 09:00' }))
    const summary = screen.getByTestId('booking-summary')
    expect(summary).toHaveTextContent('Knippen + baard')
    expect(summary).toHaveTextContent('di 6 okt 09:00')
    expect(summary.compareDocumentPosition(screen.getByRole('button', { name: 'Boeken' }))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
  } finally {
    vi.useRealTimers()
  }
})

test('another time can return to the agenda', async () => {
  window.history.replaceState(null, '', '/?lang=nl')
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-05T12:00:00'))
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  try {
    render(
      <LanguageProvider>
        <BookingForm />
      </LanguageProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Ander tijdstip vragen' }))
    expect(screen.getByLabelText('Dag')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'oktober 2026' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Terug naar het overzicht' }))
    expect(screen.getByRole('heading', { name: 'oktober 2026' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Dag')).not.toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
})

test('an empty submit shows the Dutch hint and does not navigate', async () => {
  const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {})
  render(
    <LanguageProvider>
      <BookingForm />
    </LanguageProvider>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Boeken' }))
  expect(screen.getAllByText('Vul dit nog even in.').length).toBeGreaterThan(0)
  expect(assign).not.toHaveBeenCalled()
  expect(submitBook).not.toHaveBeenCalled()
  expect(submitCustom).not.toHaveBeenCalled()
})

test('a free slot books through submitBook', async () => {
  window.history.replaceState(null, '', '/?lang=nl')
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-05T12:00:00'))
  const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {})
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  try {
    render(
      <LanguageProvider>
        <BookingForm />
      </LanguageProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Knippen' }))
    await user.click(screen.getByRole('button', { name: 'di 6 okt 09:00' }))
    await user.type(screen.getByLabelText('Naam'), 'Sam')
    await user.type(screen.getByLabelText('E-mail'), 'sam@mail.nl')
    await user.click(screen.getByRole('button', { name: 'Boeken' }))
    expect(submitBook).toHaveBeenCalledWith({
      service: 'cut',
      name: 'Sam',
      email: 'sam@mail.nl',
      phone: '',
      slot: '2026-10-06T09:00:00',
      kind: 'slot',
      lang: 'nl',
    })
    expect(await screen.findByText('Je tijd is van jou. Er gaat een mail naartoe.')).toBeInTheDocument()
    expect(assign).not.toHaveBeenCalled()
    expect(screen.queryByText(/mailto:hallo@barberbjorn.nl/)).not.toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
})

test('a custom time asks through submitCustom', async () => {
  window.history.replaceState(null, '', '/?lang=nl')
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-05T12:00:00'))
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  try {
    render(
      <LanguageProvider>
        <BookingForm />
      </LanguageProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Ander tijdstip vragen' }))
    fireEvent.change(screen.getByLabelText('Dag'), { target: { value: '2026-10-15' } })
    fireEvent.change(screen.getByLabelText('Tijd'), { target: { value: '19:30' } })
    await user.type(screen.getByLabelText('Naam'), 'Sam')
    await user.type(screen.getByLabelText('E-mail'), 'sam@mail.nl')
    await user.click(screen.getByRole('button', { name: 'Boeken' }))
    expect(submitCustom).toHaveBeenCalledWith({
      service: 'both',
      name: 'Sam',
      email: 'sam@mail.nl',
      phone: '',
      slot: '2026-10-15T19:30:00',
      kind: 'custom',
      lang: 'nl',
    })
    expect(await screen.findByText('Nog geen bevestiging. Je krijgt mail als Bjorn ja of nee zegt.')).toBeInTheDocument()
    expect(submitBook).not.toHaveBeenCalled()
  } finally {
    vi.useRealTimers()
  }
})

test('an empty Dutch submit follows the active language', async () => {
  window.history.replaceState(null, '', '/')
  localStorage.clear()
  render(
    <LanguageProvider>
      <LanguageSwitch />
      <BookingForm />
    </LanguageProvider>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Boeken' }))
  expect(screen.getAllByText('Vul dit nog even in.').length).toBeGreaterThan(0)
  await userEvent.click(screen.getByRole('button', { name: 'EN' }))
  expect(screen.getAllByText('Add this first.').length).toBeGreaterThan(0)
  expect(screen.queryByText('Vul dit nog even in.')).not.toBeInTheDocument()
})

test('opens on the first week that still has a free slot', async () => {
  window.history.replaceState(null, '', '/?lang=nl')
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-04T12:00:00'))
  try {
    render(
      <LanguageProvider>
        <BookingForm />
      </LanguageProvider>,
    )
    const slot = screen.getByRole('button', { name: 'ma 5 okt 09:00' })
    expect(slot).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'ma 28 sep 09:00' })).not.toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
})

test('a free slot can be selected without picking a service first', async () => {
  window.history.replaceState(null, '', '/?lang=nl')
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-05T12:00:00'))
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  try {
    render(
      <LanguageProvider>
        <BookingForm />
      </LanguageProvider>,
    )
    const slot = screen.getByRole('button', { name: 'di 6 okt 09:00' })
    expect(slot).toBeEnabled()
    await user.click(slot)
    expect(slot).toHaveClass('is-on')
    expect(slot).toHaveAttribute('aria-pressed', 'true')
  } finally {
    vi.useRealTimers()
  }
})

test('closed days stay visible and taken times stay blocked', async () => {
  window.history.replaceState(null, '', '/?lang=nl')
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-05T12:00:00'))
  try {
    render(
      <LanguageProvider>
        <BookingForm />
      </LanguageProvider>,
    )
    expect(screen.getByRole('heading', { name: 'oktober 2026' })).toBeInTheDocument()
    expect(screen.getAllByText('dicht')).toHaveLength(2)
    expect(screen.getByText('zo 11 okt')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ma 5 okt 10:00' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'di 6 okt 09:00' })).toBeEnabled()
    await userEvent.click(screen.getByRole('button', { name: 'Volgende week' }))
    await userEvent.click(screen.getByRole('button', { name: 'Volgende week' }))
    await userEvent.click(screen.getByRole('button', { name: 'Volgende week' }))
    expect(screen.getByRole('heading', { name: 'oktober – november 2026' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ma 26 okt 09:00' })).toBeEnabled()
  } finally {
    vi.useRealTimers()
  }
})

test('a live dashboard close updates the public agenda immediately', async () => {
  window.history.replaceState(null, '', '/?lang=nl')
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-05T12:00:00'))
  try {
    render(
      <LanguageProvider>
        <BookingForm />
      </LanguageProvider>,
    )
    expect(screen.getAllByText('dicht')).toHaveLength(2)
    loadPublicSchedule.mockResolvedValue({
      week: defaultSchedule.week,
      blocks: [{ date: '2026-10-06' }, { date: '2026-10-07', time: '15:00' }],
      bookings: [{ start: '2026-10-08T10:00:00', minutes: 45 }],
    })
    publishLiveSchedule()
    await waitFor(() => {
      expect(screen.getAllByText('dicht')).toHaveLength(3)
    })
    expect(screen.getByRole('button', { name: 'wo 7 okt 15:00' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'do 8 okt 10:00' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'do 8 okt 09:30' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'do 8 okt 11:00' })).toBeEnabled()
  } finally {
    vi.useRealTimers()
  }
})

test('the agenda follows the loaded public schedule', async () => {
  window.history.replaceState(null, '', '/?lang=nl')
  localStorage.clear()
  loadPublicSchedule.mockResolvedValue({
    ...defaultSchedule,
    blocks: [{ date: '2026-10-06' }],
  })
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-05T12:00:00'))
  try {
    render(
      <LanguageProvider>
        <BookingForm />
      </LanguageProvider>,
    )
    await waitFor(() => {
      expect(screen.getAllByText('dicht')).toHaveLength(3)
    })
  } finally {
    vi.useRealTimers()
  }
})

test('a taken book error shows the Dutch taken line', async () => {
  window.history.replaceState(null, '', '/?lang=nl')
  localStorage.clear()
  submitBook.mockResolvedValue({ ok: false, error: 'taken' })
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-05T12:00:00'))
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  try {
    render(
      <LanguageProvider>
        <BookingForm />
      </LanguageProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'di 6 okt 09:00' }))
    await user.type(screen.getByLabelText('Naam'), 'Sam')
    await user.type(screen.getByLabelText('E-mail'), 'sam@mail.nl')
    await user.click(screen.getByRole('button', { name: 'Boeken' }))
    expect(await screen.findByText('Die tijd is al weg. Kies een vrije.')).toBeInTheDocument()
    expect(screen.queryByText('taken')).not.toBeInTheDocument()
    expect(screen.queryByText('Je tijd is van jou. Er gaat een mail naartoe.')).not.toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
})

test('a successful slot book takes that start and ignores another submit', async () => {
  window.history.replaceState(null, '', '/?lang=nl')
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-05T12:00:00'))
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  try {
    render(
      <LanguageProvider>
        <BookingForm />
      </LanguageProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'di 6 okt 09:00' }))
    await user.type(screen.getByLabelText('Naam'), 'Sam')
    await user.type(screen.getByLabelText('E-mail'), 'sam@mail.nl')
    await user.click(screen.getByRole('button', { name: 'Boeken' }))
    expect(await screen.findByText('Je tijd is van jou. Er gaat een mail naartoe.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'di 6 okt 09:00' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Boeken' }))
    expect(submitBook).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Je tijd is van jou. Er gaat een mail naartoe.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'di 6 okt 10:00' }))
    await user.click(screen.getByRole('button', { name: 'Boeken' }))
    expect(submitBook).toHaveBeenCalledTimes(2)
  } finally {
    vi.useRealTimers()
  }
})

test('a second click while book is in flight does not submit twice', async () => {
  window.history.replaceState(null, '', '/?lang=nl')
  localStorage.clear()
  let release: (value: { ok: true }) => void = () => {}
  submitBook.mockImplementation(
    () =>
      new Promise((resolve) => {
        release = resolve
      }),
  )
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-05T12:00:00'))
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  try {
    render(
      <LanguageProvider>
        <BookingForm />
      </LanguageProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'di 6 okt 09:00' }))
    await user.type(screen.getByLabelText('Naam'), 'Sam')
    await user.type(screen.getByLabelText('E-mail'), 'sam@mail.nl')
    const send = screen.getByRole('button', { name: 'Boeken' })
    fireEvent.click(send)
    fireEvent.click(send)
    expect(submitBook).toHaveBeenCalledTimes(1)
    expect(send).toBeDisabled()
    release({ ok: true })
    expect(await screen.findByText('Je tijd is van jou. Er gaat een mail naartoe.')).toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
})

test('a successful custom request does not send twice', async () => {
  window.history.replaceState(null, '', '/?lang=nl')
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-05T12:00:00'))
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  try {
    render(
      <LanguageProvider>
        <BookingForm />
      </LanguageProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Ander tijdstip vragen' }))
    fireEvent.change(screen.getByLabelText('Dag'), { target: { value: '2026-10-15' } })
    fireEvent.change(screen.getByLabelText('Tijd'), { target: { value: '19:30' } })
    await user.type(screen.getByLabelText('Naam'), 'Sam')
    await user.type(screen.getByLabelText('E-mail'), 'sam@mail.nl')
    await user.click(screen.getByRole('button', { name: 'Boeken' }))
    expect(await screen.findByText('Nog geen bevestiging. Je krijgt mail als Bjorn ja of nee zegt.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Boeken' }))
    expect(submitCustom).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Nog geen bevestiging. Je krijgt mail als Bjorn ja of nee zegt.')).toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
})

test('a late schedule load keeps a start booked in this session', async () => {
  window.history.replaceState(null, '', '/?lang=nl')
  localStorage.clear()
  let releaseSchedule: (value: typeof defaultSchedule) => void = () => {}
  loadPublicSchedule.mockImplementation(
    () =>
      new Promise((resolve) => {
        releaseSchedule = resolve
      }),
  )
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-05T12:00:00'))
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  try {
    render(
      <LanguageProvider>
        <BookingForm />
      </LanguageProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'di 6 okt 09:00' }))
    await user.type(screen.getByLabelText('Naam'), 'Sam')
    await user.type(screen.getByLabelText('E-mail'), 'sam@mail.nl')
    await user.click(screen.getByRole('button', { name: 'Boeken' }))
    expect(await screen.findByText('Je tijd is van jou. Er gaat een mail naartoe.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'di 6 okt 09:00' })).toBeDisabled()
    releaseSchedule({
      ...defaultSchedule,
      bookings: [{ start: '2026-10-06T10:00:00', minutes: 45 }],
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'di 6 okt 10:00' })).toBeDisabled()
    })
    expect(screen.getByRole('button', { name: 'di 6 okt 09:00' })).toBeDisabled()
    expect(screen.getByText('Je tijd is van jou. Er gaat een mail naartoe.')).toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
})

test('a taken time reloads the agenda so the grid is honest again', async () => {
  window.history.replaceState(null, '', '/?lang=nl')
  localStorage.clear()
  submitBook.mockResolvedValue({ ok: false, error: 'taken' })
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-05T12:00:00'))
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  try {
    render(
      <LanguageProvider>
        <BookingForm />
      </LanguageProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'di 6 okt 09:00' }))
    await user.type(screen.getByLabelText('Naam'), 'Sam')
    await user.type(screen.getByLabelText('E-mail'), 'sam@mail.nl')
    loadPublicSchedule.mockResolvedValue({
      ...defaultSchedule,
      bookings: [...(defaultSchedule.bookings ?? []), { start: '2026-10-06T09:00:00', minutes: 60 }],
    })
    await user.click(screen.getByRole('button', { name: 'Boeken' }))
    expect(await screen.findByText('Die tijd is al weg. Kies een vrije.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'di 6 okt 09:00' })).toBeDisabled())
  } finally {
    vi.useRealTimers()
  }
})

test('the service label uses live minutes when services have loaded', async () => {
  loadServices.mockResolvedValue([
    { id: 'cut', price: '€32', minutes: 40 },
    { id: 'beard', price: '€18', minutes: 25 },
    { id: 'both', price: '€45', minutes: 70 },
  ])
  render(
    <LanguageProvider>
      <BookingForm />
    </LanguageProvider>,
  )
  expect(await screen.findByTestId('booking-summary')).toHaveTextContent('70 min')
})
