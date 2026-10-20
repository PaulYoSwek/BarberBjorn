import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

test('the page speaks Dutch and then English', async () => {
  window.history.replaceState(null, '', '/')
  localStorage.clear()
  window.matchMedia = () => ({
    matches: true,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
  render(
    <BrowserRouter>
      <App />
    </BrowserRouter>,
  )
  expect(screen.getByText('Een goede knip. Zonder haast.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'NL' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'EN' }))
  expect(screen.getByText('A proper cut. No rush.')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'About Bjorn’s Barber' })).toBeInTheDocument()
  // The hero button scrolls to the form; the header button opens the booking page.
  expect(screen.getAllByRole('link', { name: 'Book a visit' }).map((link) => link.getAttribute('href'))).toEqual(
    expect.arrayContaining(['#afspraak', '/afspraak?lang=en']),
  )
})
