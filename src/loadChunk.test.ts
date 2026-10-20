import { afterEach, expect, test, vi } from 'vitest'
import { loadChunk } from './App'

afterEach(() => {
  sessionStorage.clear()
  vi.restoreAllMocks()
})

test('a chunk that loads is passed through and clears the reload mark', async () => {
  sessionStorage.setItem('barber-chunk-reload', '1')
  expect(await loadChunk(async () => ({ ok: true }))).toEqual({ ok: true })
  expect(sessionStorage.getItem('barber-chunk-reload')).toBeNull()
})

test('a chunk that fails reloads the page once, then reports the failure', async () => {
  const reload = vi.fn()
  Object.defineProperty(window, 'location', { value: { ...window.location, reload }, configurable: true })
  const failing = () => Promise.reject(new Error('Failed to fetch dynamically imported module'))
  const first = loadChunk(failing)
  await Promise.resolve()
  expect(reload).toHaveBeenCalledTimes(1)
  expect(sessionStorage.getItem('barber-chunk-reload')).toBe('1')
  void first // never settles: the page is reloading
  await expect(loadChunk(failing)).rejects.toThrow('Failed to fetch')
  expect(reload).toHaveBeenCalledTimes(1)
})
