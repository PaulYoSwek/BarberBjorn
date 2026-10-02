import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { LanguageProvider } from '../language'
import { BookingForm } from './BookingForm'

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
  vi.useRealTimers()
})
