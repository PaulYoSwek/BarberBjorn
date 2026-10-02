import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { LanguageProvider } from '../language'
import { About } from './About'

test('shows Bjorn and the four lines', () => {
  render(<LanguageProvider><About /></LanguageProvider>)
  expect(screen.getByRole('img', { name: 'Bjorn' })).toHaveAttribute('src', '/portrait.png')
  expect(screen.getByText('Alleen hij. Alle tijd.')).toBeInTheDocument()
  expect(screen.getByText('Hij knipt hier zelf. Geen tweede stoel.')).toBeInTheDocument()
})
