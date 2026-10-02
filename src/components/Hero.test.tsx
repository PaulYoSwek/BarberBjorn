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
  expect(screen.getByRole('img', { name: 'BarberBjorn' })).toHaveAttribute('src', '/logo-wordmark.png')
  expect(screen.getByText('Een goede knip. Zonder haast.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Afspraak maken' })).toHaveAttribute('href', '#afspraak')
})

test('a video error keeps the copy', () => {
  renderHero()
  fireEvent.error(document.querySelector('video') as HTMLVideoElement)
  expect(document.querySelector('video')).toBeNull()
  expect(screen.getByText('Een goede knip. Zonder haast.')).toBeInTheDocument()
})
