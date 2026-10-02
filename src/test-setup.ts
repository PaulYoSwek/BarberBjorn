import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// jsdom marks Location.assign as non-configurable, so vi.spyOn cannot replace it.
// While a test is running, send that redefine attempt to the internal implementation.
const location = window.location
const locationImplSymbol = Object.getOwnPropertySymbols(location).find((symbol) => {
  const value: unknown = (location as unknown as Record<symbol, unknown>)[symbol]
  return typeof value === 'object' && value !== null && 'assign' in value && typeof value.assign === 'function'
})
const locationImpl = locationImplSymbol
  ? (location as unknown as Record<symbol, { assign: (url: string) => void }>)[locationImplSymbol]
  : undefined
const originalLocationAssign = locationImpl?.assign
const nativeDefineProperty = Object.defineProperty

function allowLocationAssignSpy() {
  if (!locationImpl || !originalLocationAssign) return
  Object.defineProperty = ((target: object, property: PropertyKey, descriptor: PropertyDescriptor) => {
    if (target === location && property === 'assign' && typeof descriptor.value === 'function') {
      const next = descriptor.value as (url: string) => void
      locationImpl.assign = next === location.assign
        ? originalLocationAssign
        : (url: string) => next.call(location, url)
      return target
    }
    return nativeDefineProperty(target, property, descriptor)
  }) as typeof Object.defineProperty
}

function restoreLocationAssign() {
  Object.defineProperty = nativeDefineProperty
  if (locationImpl && originalLocationAssign) locationImpl.assign = originalLocationAssign
}

beforeEach(allowLocationAssignSpy)

afterEach(() => {
  cleanup()
  restoreLocationAssign()
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
