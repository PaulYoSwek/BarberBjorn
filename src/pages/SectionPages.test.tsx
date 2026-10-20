import type { ReactElement } from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { LanguageProvider } from '../language'
import { defaultSchedule } from '../schedule'
import { AboutPage, BookPage, ContactPage, FaqPage, ServicesPage } from './SectionPages'

vi.mock('../planning-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../planning-api')>()
  return {
    ...actual,
    loadServices: vi.fn(async () => []),
    loadPublicSchedule: vi.fn(async () => defaultSchedule),
  }
})

function show(page: ReactElement, path: string) {
  window.history.replaceState(null, '', path)
  localStorage.clear()
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LanguageProvider>{page}</LanguageProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  document.head.querySelector('link[rel="canonical"]')?.remove()
})

test('each section page has its own title, the header and the footer', () => {
  const pages: [ReactElement, string, string][] = [
    [<ServicesPage />, '/diensten', 'Diensten en prijzen'],
    [<AboutPage />, '/over-bjorn', 'Over Bjorn'],
    [<FaqPage />, '/vragen', 'Veelgestelde vragen'],
    [<ContactPage />, '/contact', 'Contact'],
    [<BookPage />, '/afspraak', 'Afspraak maken'],
  ]
  for (const [page, path, title] of pages) {
    const view = show(page, path)
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument()
    expect(document.title).toBe(`${title} · Bjorn’s Barber`)
    expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute('href', `https://www.bjornsbarber.nl${path}`)
    expect(screen.getByRole('link', { name: 'Diensten' })).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    view.unmount()
  }
})

test('the services page shows the plates and the contact page the address and phone', () => {
  const services = show(<ServicesPage />, '/diensten')
  expect(screen.getByText('Knippen + baard')).toBeInTheDocument()
  services.unmount()
  show(<ContactPage />, '/contact')
  // Once in the details and, without a map token, once more as the map's text fallback.
  expect(screen.getAllByText('Ferdinandstraat 21, 4571 AN Axel').length).toBeGreaterThan(0)
  // The number is in the details and again in the footer.
  for (const link of screen.getAllByRole('link', { name: '+31 6 48163783' })) expect(link).toHaveAttribute('href', 'tel:+31648163783')
  expect(screen.getByRole('link', { name: 'Route' })).toHaveAttribute('href', expect.stringContaining('google.com/maps'))
})
