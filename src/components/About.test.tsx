import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { LanguageProvider } from '../language'
import { About } from './About'

test('shows Bjorn and his story', () => {
  render(<LanguageProvider><About /></LanguageProvider>)
  const portrait = screen.getByRole('img', { name: /Bjorn, kapper en barbier/ })
  expect(portrait).toHaveAttribute('src', '/portrait.png')
  expect(portrait).toHaveAttribute('loading', 'lazy')
  expect(document.querySelector('source[type="image/webp"]')).toHaveAttribute('srcset', '/portrait.webp')
  expect(screen.getByRole('heading', { name: 'Over Bjorn’s Barber' })).toBeInTheDocument()
  expect(screen.getByText(/Inmiddels heb ik 8 jaar ervaring als barber/)).toBeInTheDocument()
  expect(screen.getByText(/Ik doe geen lopendebandwerk\./)).toBeInTheDocument()
  expect(screen.getByText('Persoonlijke aandacht. Kwaliteit. En een kapsel waar je met vertrouwen mee naar buiten loopt.')).toBeInTheDocument()
})
