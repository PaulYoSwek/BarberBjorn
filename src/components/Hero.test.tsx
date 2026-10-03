import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { LanguageProvider } from '../language'
import { Hero } from './Hero'

function renderHero(search = '') {
  window.history.replaceState(null, '', `/${search}`)
  localStorage.clear()
  return render(
    <LanguageProvider>
      <Hero />
    </LanguageProvider>,
  )
}

test('shows the Dutch line and a link to the form', () => {
  renderHero()
  expect(screen.getByRole('img', { name: 'BarberBjorn' })).toHaveAttribute('src', '/logo-name.png?v=2')
  expect(screen.getByText('Een goede knip. Zonder haast.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Afspraak maken' })).toHaveAttribute('href', '#afspraak')
})

test('a video error keeps the copy', () => {
  renderHero()
  fireEvent.error(document.querySelector('video') as HTMLVideoElement)
  expect(document.querySelector('video')).toBeNull()
  expect(screen.getByText('Een goede knip. Zonder haast.')).toBeInTheDocument()
})

test('directions open Google Maps at the shop', () => {
  renderHero()
  const link = screen.getByRole('link', { name: 'Route' })
  expect(link).toHaveAttribute(
    'href',
    'https://www.google.com/maps/dir/?api=1&destination=51.262824,3.919134',
  )
  expect(link).toHaveAttribute('target', '_blank')
  expect(link).toHaveAttribute('rel', 'noopener noreferrer')
})

test('the directions label follows the language', () => {
  renderHero('?lang=en')
  expect(screen.getByRole('link', { name: 'Directions' })).toBeInTheDocument()
})

test('the map shows a small shop address', () => {
  renderHero()
  const address = document.querySelector('.map-address')
  expect(address).toHaveTextContent('Ferdinandstraat 8')
  expect(address).toHaveTextContent('4571 AP Axel')
  expect(address?.closest('.hero-map')).toBeTruthy()
})
