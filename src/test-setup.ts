import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

vi.mock('mapbox-gl', () => {
  class Map {
    on() {}
    remove() {}
    setLanguage() {}
  }
  class Marker {
    setLngLat() { return this }
    addTo() { return this }
  }
  return { default: { accessToken: '', Map, Marker } }
})
