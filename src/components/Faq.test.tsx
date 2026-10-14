import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { LanguageProvider } from '../language'
import { Faq } from './Faq'

test('all five answers are visible', () => {
  render(<LanguageProvider><Faq /></LanguageProvider>)
  expect(screen.getByRole('heading', { level: 2, name: 'Voordat je langskomt.' })).toBeInTheDocument()
  expect(screen.getByText('Moet ik een afspraak maken?')).toBeInTheDocument()
  expect(screen.getByText('Ferdinandstraat 21 in Axel. De kaart bovenaan wijst de deur.')).toBeInTheDocument()
  expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(4)
  expect(screen.queryByText('Mag ik de muziek kiezen?')).not.toBeInTheDocument()
  expect(screen.getByText('Ja, elke klant boekt zijn eigen afspraak, zodat je niet uren hoeft te wachten.')).toBeInTheDocument()
  expect(screen.getByText(/knippen \+ baard 75 minuten/)).toBeInTheDocument()
  expect(screen.getByText('01')).toBeInTheDocument()
  expect(screen.getByText('04')).toBeInTheDocument()
  expect(screen.queryByText('05')).not.toBeInTheDocument()
})
