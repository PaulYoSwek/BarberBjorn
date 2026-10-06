import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { LanguageProvider } from '../language'
import { MapPanel } from './MapPanel'

test('without a token the address is text', () => {
  render(
    <LanguageProvider>
      <MapPanel />
    </LanguageProvider>,
  )
  expect(screen.getByText('Ferdinandstraat 21, 4571 AN Axel')).toBeInTheDocument()
  expect(document.querySelector('.mapboxgl-map')).toBeNull()
})
