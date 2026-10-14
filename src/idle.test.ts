import { afterEach, expect, test, vi } from 'vitest'
import { onFirstInteraction, prefersStills, whenIdle } from './idle'

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

test('first-interaction work runs once on the first movement, or after the fallback', () => {
  vi.useFakeTimers()
  const work = vi.fn()
  onFirstInteraction(work, 3000)
  window.dispatchEvent(new Event('pointermove'))
  window.dispatchEvent(new Event('scroll'))
  vi.advanceTimersByTime(5000)
  expect(work).toHaveBeenCalledTimes(1)

  const later = vi.fn()
  onFirstInteraction(later, 3000)
  vi.advanceTimersByTime(2999)
  expect(later).not.toHaveBeenCalled()
  vi.advanceTimersByTime(1)
  expect(later).toHaveBeenCalledTimes(1)

  const never = vi.fn()
  const cancel = onFirstInteraction(never, 100)
  cancel()
  window.dispatchEvent(new Event('keydown'))
  vi.advanceTimersByTime(1000)
  expect(never).not.toHaveBeenCalled()
})
