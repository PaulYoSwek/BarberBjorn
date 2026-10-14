import { afterEach, expect, test, vi } from 'vitest'
import { prefersStills, whenIdle } from './idle'

afterEach(() => {
  vi.useRealTimers()
})

test('idle work waits for the page to load, then runs once', () => {
  vi.useFakeTimers()
  const work = vi.fn()
  Object.defineProperty(document, 'readyState', { value: 'loading', configurable: true })
  whenIdle(work)
  expect(work).not.toHaveBeenCalled()
  window.dispatchEvent(new Event('load'))
  vi.runAllTimers()
  expect(work).toHaveBeenCalledTimes(1)
  Object.defineProperty(document, 'readyState', { value: 'complete', configurable: true })
})

test('cancelled idle work never runs', () => {
  vi.useFakeTimers()
  const work = vi.fn()
  const cancel = whenIdle(work)
  cancel()
  vi.runAllTimers()
  expect(work).not.toHaveBeenCalled()
})

test('stills are preferred with reduced motion or data saving', () => {
  expect(prefersStills()).toBe(false)
  Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true })
  expect(prefersStills()).toBe(true)
  Object.defineProperty(navigator, 'connection', { value: undefined, configurable: true })
})
