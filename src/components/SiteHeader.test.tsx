import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { LanguageProvider } from '../language'
import { SiteHeader } from './SiteHeader'

function renderHeader(path = '/') {
  window.history.replaceState(null, '', path)
  localStorage.clear()
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LanguageProvider>
        <SiteHeader />
      </LanguageProvider>
    </MemoryRouter>,
  )
}

test('the header names every section and links to its page', () => {
  renderHeader()
  expect(screen.getByRole('link', { name: 'Diensten' })).toHaveAttribute('href', '/diensten')
  expect(screen.getByRole('link', { name: 'Over Bjorn' })).toHaveAttribute('href', '/over-bjorn')
  expect(screen.getByRole('link', { name: 'Vragen' })).toHaveAttribute('href', '/vragen')
  expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact')
  expect(screen.getByRole('link', { name: 'Afspraak maken' })).toHaveAttribute('href', '/afspraak')
  expect(screen.getByRole('link', { name: 'Naar de voorpagina' })).toHaveAttribute('href', '/')
})

test('in English the links keep the language and the current page is marked', () => {
  renderHeader('/diensten?lang=en')
  expect(screen.getByRole('link', { name: 'Services' })).toHaveAttribute('href', '/diensten?lang=en')
  expect(screen.getByRole('link', { name: 'Services' })).toHaveClass('is-on')
  expect(screen.getByRole('link', { name: 'About Bjorn' })).not.toHaveClass('is-on')
  expect(screen.getByRole('link', { name: 'Book a visit' })).toHaveAttribute('href', '/afspraak?lang=en')
})

test('the phone menu opens, closes with Escape and reports its state', async () => {
  renderHeader()
  const toggle = screen.getByRole('button', { name: 'Menu' })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await userEvent.click(toggle)
  expect(screen.getByRole('button', { name: 'Menu sluiten' })).toHaveAttribute('aria-expanded', 'true')
  expect(document.querySelector('.site-header')).toHaveClass('is-open')
  await userEvent.keyboard('{Escape}')
  expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'false')
})
