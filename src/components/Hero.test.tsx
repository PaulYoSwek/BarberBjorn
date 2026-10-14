import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
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
  expect(screen.getByRole('img', { name: 'Bjorn’s Barber' })).toHaveAttribute('src', '/logo-name.png?v=3')
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
    'https://www.google.com/maps/dir/?api=1&destination=51.262565,3.91918',
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
  expect(address).toHaveTextContent('Ferdinandstraat 21')
  expect(address).toHaveTextContent('4571 AN Axel')
  expect(address?.closest('.hero-map')).toBeTruthy()
})

test('the video waits for an idle page and phones get the small file', () => {
  // jsdom has no requestIdleCallback; stand one in that runs at once.
  const idle = vi.fn((fn: () => void) => {
    fn()
    return 1
  })
  Object.defineProperty(window, 'requestIdleCallback', { value: idle, configurable: true, writable: true })
  const media = window.matchMedia
  window.matchMedia = ((query: string) => ({ ...media(query), matches: query.includes('max-width') })) as typeof window.matchMedia
  try {
    renderHero()
    expect(document.querySelector('video')).toHaveAttribute('src', '/hero-mobile.mp4')
    expect(document.querySelector('video')).toHaveAttribute('preload', 'none')
  } finally {
    window.matchMedia = media
    Object.defineProperty(window, 'requestIdleCallback', { value: undefined, configurable: true, writable: true })
  }
})

test('reduced motion means no video at all', () => {
  const media = window.matchMedia
  window.matchMedia = ((query: string) => ({ ...media(query), matches: query.includes('reduced-motion') })) as typeof window.matchMedia
  try {
    renderHero()
    expect(document.querySelector('video')).toBeNull()
    expect(screen.getByText('Een goede knip. Zonder haast.')).toBeInTheDocument()
  } finally {
    window.matchMedia = media
  }
})
