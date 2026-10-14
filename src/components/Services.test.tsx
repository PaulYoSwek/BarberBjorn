import { render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { LanguageProvider } from '../language'
import { Services } from './Services'

const { loadServices } = vi.hoisted(() => ({
  loadServices: vi.fn(),
}))

vi.mock('../planning-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../planning-api')>()
  return { ...actual, loadServices }
})

beforeEach(() => {
  loadServices.mockReset()
  loadServices.mockResolvedValue([])
})

test('lists the three prices with the combo marked', () => {
  render(<LanguageProvider><Services /></LanguageProvider>)
  expect(screen.getByText('€30')).toBeInTheDocument()
  expect(screen.getByText('€15')).toBeInTheDocument()
  expect(screen.getByText('€40')).toBeInTheDocument()
  expect(document.querySelector('.is-both')).toHaveTextContent('Knippen + baard')
})

test('replaces seed prices when live services are not empty', async () => {
  loadServices.mockResolvedValue([
    { id: 'cut', price: '€32', minutes: 40 },
    { id: 'beard', price: '€18', minutes: 25 },
    { id: 'both', price: '€45', minutes: 70 },
  ])
  render(<LanguageProvider><Services /></LanguageProvider>)
  expect(await screen.findByText('€32')).toBeInTheDocument()
  expect(screen.getByText('€18')).toBeInTheDocument()
  expect(screen.getByText('€45')).toBeInTheDocument()
  expect(screen.queryByText('€30')).not.toBeInTheDocument()
})


test('a price saved without the euro sign is shown with it', async () => {
  loadServices.mockResolvedValue([
    { id: 'cut', price: '27,50', minutes: 45 },
    { id: 'beard', price: '20', minutes: 30 },
    { id: 'both', price: ' 35 ', minutes: 75 },
  ])
  render(<LanguageProvider><Services /></LanguageProvider>)
  expect(await screen.findByText('€27,50')).toBeInTheDocument()
  expect(screen.getByText('€20')).toBeInTheDocument()
  expect(screen.getByText('€35')).toBeInTheDocument()
  expect(screen.queryByText('27,50')).not.toBeInTheDocument()
})

test('services added in the dashboard show under the plates; hidden ones do not', async () => {
  loadServices.mockResolvedValue([
  { id: 'cut', price: '€27,50', minutes: 45, name: { nl: 'Knippen', en: 'Cut' }, detail: { nl: 'Haar', en: 'Hair' }, sort: 1, active: true },
  { id: 'beard', price: '€20', minutes: 30, name: { nl: 'Baard', en: 'Beard' }, detail: { nl: '', en: '' }, sort: 2, active: true },
  { id: 'both', price: '€35', minutes: 75, name: { nl: 'Knippen + baard', en: 'Cut + beard' }, detail: { nl: '', en: '' }, sort: 3, active: true },
  { id: 'kids', price: '€15', minutes: 30, name: { nl: 'Kinderen knippen', en: 'Kids cut' }, detail: { nl: 'Tot 12 jaar', en: 'Up to 12' }, sort: 4, active: true },
  { id: 'old', price: '€99', minutes: 60, name: { nl: 'Oude dienst', en: '' }, detail: { nl: '', en: '' }, sort: 5, active: false },
])
  render(<LanguageProvider><Services /></LanguageProvider>)
  expect(await screen.findByText('Kinderen knippen')).toBeInTheDocument()
  expect(screen.getByText('€15')).toBeInTheDocument()
  expect(screen.getByText('Tot 12 jaar')).toBeInTheDocument()
  expect(document.querySelectorAll('.plates article')).toHaveLength(3)
  expect(document.querySelector('.services-more')).toHaveTextContent('Kinderen knippen')
  expect(screen.queryByText('Oude dienst')).not.toBeInTheDocument()
  expect(screen.queryByText('€99')).not.toBeInTheDocument()
})
