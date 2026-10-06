import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { LanguageProvider } from '../language'
import { About } from './About'

test('shows Bjorn and the four lines', () => {
  render(<LanguageProvider><About /></LanguageProvider>)
  const portrait = screen.getByRole('img', { name: /Bjorn, kapper en barbier/ })
  expect(portrait).toHaveAttribute('src', '/portrait.png')
  expect(portrait).toHaveAttribute('loading', 'lazy')
  expect(document.querySelector('source[type="image/webp"]')).toHaveAttribute('srcset', '/portrait.webp')
  expect(screen.getByText('Alleen hij. Alle tijd.')).toBeInTheDocument()
  expect(screen.getByText('Hij knipt hier zelf. Geen tweede stoel.')).toBeInTheDocument()
})
