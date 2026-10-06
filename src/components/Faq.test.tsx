import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { LanguageProvider } from '../language'
import { Faq } from './Faq'

test('all five answers are visible', () => {
  render(<LanguageProvider><Faq /></LanguageProvider>)
  expect(screen.getByRole('heading', { level: 2, name: 'Voor je komt.' })).toBeInTheDocument()
  expect(screen.getByText('Moet ik een afspraak maken?')).toBeInTheDocument()
  expect(screen.getByText('Ferdinandstraat 21 in Axel. De kaart bovenaan wijst de deur.')).toBeInTheDocument()
  expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(5)
  expect(screen.getByText('01')).toBeInTheDocument()
  expect(screen.getByText('05')).toBeInTheDocument()
})
