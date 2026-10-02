import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { LanguageProvider } from '../language'
import { Faq } from './Faq'

test('all five answers are visible', () => {
  render(<LanguageProvider><Faq /></LanguageProvider>)
  expect(screen.getByText('Moet ik een afspraak maken?')).toBeInTheDocument()
  expect(screen.getByText('Olivierstraat 20 in Axel. De kaart bovenaan wijst de deur.')).toBeInTheDocument()
  expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(5)
  expect(screen.getByText('01')).toBeInTheDocument()
  expect(screen.getByText('05')).toBeInTheDocument()
})
