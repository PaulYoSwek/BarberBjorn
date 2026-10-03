import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { LanguageProvider } from '../language'
import { defaultSchedule } from '../schedule'
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

test('an empty submit shows the Dutch hint and does not navigate', async () => {
  const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {})
  render(
    <LanguageProvider>
      <BookingForm />
    </LanguageProvider>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Verstuur' }))
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
    await user.selectOptions(screen.getByLabelText(/Dienst/), 'cut')
    await user.click(screen.getByRole('button', { name: 'di 6 okt 09:00' }))
    await user.type(screen.getByLabelText('Naam'), 'Sam')
    await user.type(screen.getByLabelText('E-mail'), 'sam@mail.nl')
    await user.click(screen.getByRole('button', { name: 'Verstuur' }))
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
    await user.selectOptions(screen.getByLabelText(/Dienst/), 'cut')
    await user.click(screen.getByRole('button', { name: 'Ander tijdstip vragen' }))
    fireEvent.change(screen.getByLabelText('Dag'), { target: { value: '2026-10-15' } })
    fireEvent.change(screen.getByLabelText('Tijd'), { target: { value: '19:30' } })
    await user.type(screen.getByLabelText('Naam'), 'Sam')
    await user.type(screen.getByLabelText('E-mail'), 'sam@mail.nl')
    await user.click(screen.getByRole('button', { name: 'Verstuur' }))
    expect(submitCustom).toHaveBeenCalledWith({
      service: 'cut',
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
  await userEvent.click(screen.getByRole('button', { name: 'Verstuur' }))
  expect(screen.getAllByText('Vul dit nog even in.').length).toBeGreaterThan(0)
  await userEvent.click(screen.getByRole('button', { name: 'EN' }))
  expect(screen.getAllByText('Add this first.').length).toBeGreaterThan(0)
  expect(screen.queryByText('Vul dit nog even in.')).not.toBeInTheDocument()
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
    await userEvent.selectOptions(screen.getByLabelText(/Dienst/), 'cut')
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
    await user.selectOptions(screen.getByLabelText(/Dienst/), 'cut')
    await user.click(screen.getByRole('button', { name: 'di 6 okt 09:00' }))
    await user.type(screen.getByLabelText('Naam'), 'Sam')
    await user.type(screen.getByLabelText('E-mail'), 'sam@mail.nl')
    await user.click(screen.getByRole('button', { name: 'Verstuur' }))
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
    await user.selectOptions(screen.getByLabelText(/Dienst/), 'cut')
    await user.click(screen.getByRole('button', { name: 'di 6 okt 09:00' }))
    await user.type(screen.getByLabelText('Naam'), 'Sam')
    await user.type(screen.getByLabelText('E-mail'), 'sam@mail.nl')
    await user.click(screen.getByRole('button', { name: 'Verstuur' }))
    expect(await screen.findByText('Je tijd is van jou. Er gaat een mail naartoe.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'di 6 okt 09:00' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Verstuur' }))
    expect(submitBook).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Je tijd is van jou. Er gaat een mail naartoe.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'di 6 okt 10:00' }))
    await user.click(screen.getByRole('button', { name: 'Verstuur' }))
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
    await user.selectOptions(screen.getByLabelText(/Dienst/), 'cut')
    await user.click(screen.getByRole('button', { name: 'di 6 okt 09:00' }))
    await user.type(screen.getByLabelText('Naam'), 'Sam')
    await user.type(screen.getByLabelText('E-mail'), 'sam@mail.nl')
    fireEvent.click(screen.getByRole('button', { name: 'Verstuur' }))
    fireEvent.click(screen.getByRole('button', { name: 'Verstuur' }))
    expect(submitBook).toHaveBeenCalledTimes(1)
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
    await user.selectOptions(screen.getByLabelText(/Dienst/), 'cut')
    await user.click(screen.getByRole('button', { name: 'Ander tijdstip vragen' }))
    fireEvent.change(screen.getByLabelText('Dag'), { target: { value: '2026-10-15' } })
    fireEvent.change(screen.getByLabelText('Tijd'), { target: { value: '19:30' } })
    await user.type(screen.getByLabelText('Naam'), 'Sam')
    await user.type(screen.getByLabelText('E-mail'), 'sam@mail.nl')
    await user.click(screen.getByRole('button', { name: 'Verstuur' }))
    expect(await screen.findByText('Nog geen bevestiging. Je krijgt mail als Bjorn ja of nee zegt.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Verstuur' }))
    expect(submitCustom).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Nog geen bevestiging. Je krijgt mail als Bjorn ja of nee zegt.')).toBeInTheDocument()
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
  const user = userEvent.setup()
  render(
    <LanguageProvider>
      <BookingForm />
    </LanguageProvider>,
  )
  await user.selectOptions(screen.getByLabelText(/Dienst/), 'cut')
  expect(await screen.findByLabelText(/40 min/)).toBeInTheDocument()
})
