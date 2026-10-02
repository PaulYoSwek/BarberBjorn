import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { Footer } from './Footer'

test('shows the placeholder contact', () => {
  render(<Footer />)
  expect(screen.getByRole('link', { name: 'hallo@barberbjorn.nl' })).toHaveAttribute('href', 'mailto:hallo@barberbjorn.nl')
  expect(screen.getByRole('link', { name: '06 12 34 56 78' })).toHaveAttribute('href', 'tel:+31612345678')
  expect(screen.getByText('Olivierstraat 20, Axel')).toBeInTheDocument()
})
