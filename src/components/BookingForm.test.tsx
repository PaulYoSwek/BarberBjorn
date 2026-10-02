import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { LanguageProvider } from '../language'
import { BookingForm } from './BookingForm'
import { LanguageSwitch } from './LanguageSwitch'

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
})

test('a valid weekday opens a mailto', async () => {
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
    await user.selectOptions(screen.getByLabelText('Dienst'), 'cut')
    await user.type(screen.getByLabelText('Naam'), 'Sam')
    await user.type(screen.getByLabelText('Telefoon'), '0612345678')
    fireEvent.change(screen.getByLabelText('Dag'), { target: { value: '2026-10-06' } })
    await user.click(screen.getByRole('button', { name: 'Verstuur' }))
    expect(assign).toHaveBeenCalled()
    expect(String(assign.mock.calls[0][0])).toContain('mailto:hallo@barberbjorn.nl')
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('De mail opent niet. Kopieer het adres en de aanvraag.')
    expect(alert).toHaveTextContent('hallo@barberbjorn.nl')
    expect(alert).toHaveTextContent('Sam')
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

test('a Saturday Dutch submit follows the active language', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-05T12:00:00'))
  window.history.replaceState(null, '', '/')
  localStorage.clear()
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  try {
    render(
      <LanguageProvider>
        <LanguageSwitch />
        <BookingForm />
      </LanguageProvider>,
    )
    await user.selectOptions(screen.getByLabelText('Dienst'), 'cut')
    await user.type(screen.getByLabelText('Naam'), 'Sam')
    await user.type(screen.getByLabelText('Telefoon'), '0612345678')
    fireEvent.change(screen.getByLabelText('Dag'), { target: { value: '2026-10-10' } })
    await user.click(screen.getByRole('button', { name: 'Verstuur' }))
    expect(screen.getByText('Zaterdag en zondag is de stoel dicht. Kies een weekdag.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'EN' }))
    expect(screen.getByText('Saturday and Sunday the chair is closed. Pick a weekday.')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Sam')
  } finally {
    vi.useRealTimers()
  }
})
