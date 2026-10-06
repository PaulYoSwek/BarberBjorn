import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { LanguageProvider } from '../language'
import { Footer } from './Footer'

function renderFooter(search = '') {
  window.history.replaceState(null, '', `/${search}`)
  localStorage.clear()
  return render(
    <LanguageProvider>
      <Footer />
    </LanguageProvider>,
  )
}

test('shows the placeholder contact', () => {
  renderFooter()
  expect(screen.getByRole('link', { name: 'hallo@barberbjorn.nl' })).toHaveAttribute('href', 'mailto:hallo@barberbjorn.nl')
  expect(screen.getByRole('link', { name: '06 12 34 56 78' })).toHaveAttribute('href', 'tel:+31612345678')
  expect(screen.getByText('Ferdinandstraat 21, Axel')).toBeInTheDocument()
})

test('credits TurboTurtle with a followed backlink in both languages', () => {
  renderFooter()
  const credit = screen.getByRole('link', { name: 'TurboTurtle' })
  expect(credit).toHaveAttribute('href', 'https://turboturtle.nl')
  expect(credit).toHaveAttribute('target', '_blank')
  expect(credit.getAttribute('rel') ?? '').not.toMatch(/nofollow/)
  expect(screen.getByText(/Website door/)).toBeInTheDocument()
  renderFooter('?lang=en')
  expect(screen.getByText(/Website by/)).toBeInTheDocument()
})
