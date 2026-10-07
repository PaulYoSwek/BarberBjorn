import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { AdminProducts } from './AdminProducts'

const { saveProduct } = vi.hoisted(() => ({ saveProduct: vi.fn() }))

vi.mock('../../planning-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../planning-api')>()
  return { ...actual, saveProduct }
})

const products = [
  { id: 'p1', name: 'Wax', price: 12.5, stock: 8, active: true },
  { id: 'p2', name: 'Kam', price: 4, stock: 2, active: true },
  { id: 'p3', name: 'Oude pommade', price: 9, stock: 0, active: false },
]

beforeEach(() => {
  saveProduct.mockReset()
  saveProduct.mockResolvedValue({ ok: true })
})

test('lists products with price and stock, flags low stock, hides what is not for sale', () => {
  render(<AdminProducts products={products} ready loaded onChanged={() => {}} />)
  const wax = screen.getByRole('heading', { name: 'Wax' }).closest('li')!
  expect(wax).toHaveTextContent('€12,50')
  expect(wax).toHaveTextContent('8 op voorraad')
  const kam = screen.getByRole('heading', { name: 'Kam' }).closest('li')!
  expect(kam).toHaveClass('is-low')
  expect(kam).toHaveTextContent('bijna op')
  expect(screen.queryByRole('heading', { name: 'Oude pommade' })).not.toBeInTheDocument()
  // Tiles: 2 for sale, 1 nearly out, stock worth 8 × 12,50 + 2 × 4.
  expect(screen.getByText('Voorraadwaarde').nextElementSibling).toHaveTextContent('€108')
  expect(screen.getByText('Bijna op').nextElementSibling).toHaveTextContent('1')
})

test('a new product is saved with a Dutch price and a stock count', async () => {
  const onChanged = vi.fn()
  render(<AdminProducts products={products} ready loaded onChanged={onChanged} />)
  await userEvent.click(screen.getByRole('button', { name: '+ Product toevoegen' }))
  const form = screen.getByRole('form', { name: 'Product toevoegen' })
  await userEvent.type(within(form).getByLabelText('Naam'), 'Pommade')
  await userEvent.type(within(form).getByLabelText('Prijs'), '14,95')
  await userEvent.clear(within(form).getByLabelText('Voorraad'))
  await userEvent.type(within(form).getByLabelText('Voorraad'), '12')
  await userEvent.click(within(form).getByRole('button', { name: 'Opslaan' }))
  expect(saveProduct).toHaveBeenCalledWith({ id: undefined, name: 'Pommade', price: 14.95, stock: 12, active: true })
  expect(await screen.findByRole('status')).toHaveTextContent('Pommade is toegevoegd.')
  expect(onChanged).toHaveBeenCalled()
})

test('editing keeps the id and a product can be taken off sale', async () => {
  render(<AdminProducts products={products} ready loaded onChanged={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: 'Wax bewerken' }))
  const form = screen.getByRole('form', { name: 'Product bewerken' })
  expect(within(form).getByLabelText('Prijs')).toHaveValue('12,50')
  await userEvent.clear(within(form).getByLabelText('Prijs'))
  await userEvent.type(within(form).getByLabelText('Prijs'), '13')
  await userEvent.click(within(form).getByRole('button', { name: 'Opslaan' }))
  expect(saveProduct).toHaveBeenCalledWith({ id: 'p1', name: 'Wax', price: 13, stock: 8, active: true })
  await userEvent.click(screen.getByRole('button', { name: 'Kam niet meer verkopen' }))
  expect(saveProduct).toHaveBeenLastCalledWith({ id: 'p2', name: 'Kam', price: 4, stock: 2, active: false })
})
