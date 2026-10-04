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

