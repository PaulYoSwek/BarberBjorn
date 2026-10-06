import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import App from '../App'

function renderAt(path: string) {
  window.history.replaceState(null, '', path)
  localStorage.clear()
  render(
    <BrowserRouter>
      <App />
    </BrowserRouter>,
  )
}

test('the privacy statement covers data, processors, retention, rights and cookies', async () => {
  renderAt('/privacy')
  expect(await screen.findByRole('heading', { level: 1, name: 'Privacy- en cookieverklaring' })).toBeInTheDocument()
  for (const heading of ['Welke gegevens we bewaren', 'Wie je gegevens nog meer ziet', 'Hoe lang we ze bewaren', 'Jouw rechten', 'Cookies en lokale opslag']) {
    expect(screen.getByRole('heading', { level: 2, name: heading })).toBeInTheDocument()
  }
  expect(screen.getByText(/telefoonnummer/)).toBeInTheDocument()
  expect(screen.getByText(/Supabase/)).toBeInTheDocument()
  expect(screen.getByText(/Autoriteit Persoonsgegevens/)).toBeInTheDocument()
  expect(screen.getByText(/geen tracking-, analyse- of advertentiecookies/)).toBeInTheDocument()
  expect(document.title).toBe('Privacy- en cookieverklaring · Bjorn’s Barber')
})

test('the privacy statement follows the English switch', async () => {
  renderAt('/privacy?lang=en')
  expect(await screen.findByRole('heading', { level: 1, name: 'Privacy and cookie statement' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: 'Your rights' })).toBeInTheDocument()
})
