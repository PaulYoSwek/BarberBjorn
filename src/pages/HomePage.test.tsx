import { act, render } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { LanguageProvider } from '../language'
import { HomePage } from './HomePage'

afterEach(() => {
  vi.useRealTimers()
  sessionStorage.clear()
})

test('a link to #afspraak scrolls to the booking form once the intro is gone', () => {
  vi.useFakeTimers()
  window.history.replaceState(null, '', '/#afspraak')
  const scroll = vi.fn()
  Element.prototype.scrollIntoView = scroll
  render(
    <MemoryRouter>
      <LanguageProvider>
        <HomePage />
      </LanguageProvider>
    </MemoryRouter>,
  )
  // While the intro covers the page nothing scrolls.
  vi.advanceTimersByTime(10)
  expect(scroll).not.toHaveBeenCalled()
  const curtain = document.querySelector('.splash-curtain') as HTMLElement
  const end = new Event('animationend', { bubbles: true })
  Object.defineProperty(end, 'animationName', { value: 'splash-wipe' })
  act(() => {
    curtain.dispatchEvent(end)
  })
  vi.advanceTimersByTime(10)
  expect(scroll).toHaveBeenCalledTimes(1)
  expect(scroll).toHaveBeenCalledWith({ behavior: 'instant' })
  expect((scroll.mock.instances[0] as Element).id).toBe('afspraak')
  window.history.replaceState(null, '', '/')
})

test('with the intro already seen, #afspraak scrolls right away', () => {
  vi.useFakeTimers()
  sessionStorage.setItem('barber-splash-seen', '1')
  window.history.replaceState(null, '', '/#afspraak')
  const scroll = vi.fn()
  Element.prototype.scrollIntoView = scroll
  render(
    <MemoryRouter>
      <LanguageProvider>
        <HomePage />
      </LanguageProvider>
    </MemoryRouter>,
  )
  // The page keeps a refresh interval running, so only step past the scroll timer.
  vi.advanceTimersByTime(10)
  expect(scroll).toHaveBeenCalledTimes(1)
  expect((scroll.mock.instances[0] as Element).id).toBe('afspraak')
  window.history.replaceState(null, '', '/')
})

test('the intro plays once per visit', () => {
  window.history.replaceState(null, '', '/')
  const first = render(
    <MemoryRouter>
      <LanguageProvider>
        <HomePage />
      </LanguageProvider>
    </MemoryRouter>,
  )
  expect(document.querySelector('.splash')).not.toBeNull()
  first.unmount()
  sessionStorage.setItem('barber-splash-seen', '1')
  render(
    <MemoryRouter>
      <LanguageProvider>
        <HomePage />
      </LanguageProvider>
    </MemoryRouter>,
  )
  expect(document.querySelector('.splash')).toBeNull()
})
