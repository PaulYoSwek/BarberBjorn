import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { LanguageProvider } from '../language'
import { MapPanel, staticMapUrl } from './MapPanel'

test('without a token the address is text', () => {
  render(
    <LanguageProvider>
      <MapPanel />
    </LanguageProvider>,
  )
  expect(screen.getByText('Ferdinandstraat 21, 4571 AN Axel')).toBeInTheDocument()
  expect(document.querySelector('.mapboxgl-map')).toBeNull()
})

test('the map still is sized to the panel and never past what Mapbox allows', () => {
  const url = staticMapUrl(375.6, 340.2, 'pk.test')
  expect(url).toContain('/static/pin-l+f5c400(3.91918,51.262565)/3.91918,51.262565,15,0/376x340@2x?access_token=pk.test')
  expect(staticMapUrl(3000, 50, 'pk.test')).toContain('/1280x100@2x')
})
