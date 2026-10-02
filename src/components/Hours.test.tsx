import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { LanguageProvider } from '../language'
import { Hours } from './Hours'

test('weekdays share one time and the weekend is closed', () => {
  render(<LanguageProvider><Hours /></LanguageProvider>)
  expect(screen.getByText(/09:00/)).toBeInTheDocument()
  expect(screen.getByText(/18:00/)).toBeInTheDocument()
  expect(screen.getAllByText('dicht')).toHaveLength(2)
  expect(document.querySelectorAll('.hours-day')).toHaveLength(7)
})
