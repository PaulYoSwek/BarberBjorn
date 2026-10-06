import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { Splash } from './Splash'

function setMotion(reduce: boolean) {
  window.matchMedia = (query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

test('reduced motion skips the splash', () => {
  setMotion(true)
  const onDone = vi.fn()
  const { container } = render(<Splash onDone={onDone} />)
  expect(onDone).toHaveBeenCalledOnce()
  expect(container).toBeEmptyDOMElement()
})

test('the wipe ending reveals the page', () => {
  setMotion(false)
  const onDone = vi.fn()
  render(<Splash onDone={onDone} />)
  expect(screen.getByRole('img', { name: 'Bjorn’s Barber' })).toBeInTheDocument()
  const curtain = document.querySelector('.splash-curtain') as HTMLElement
  const event = new Event('animationend', { bubbles: true })
  Object.defineProperty(event, 'animationName', { value: 'splash-wipe' })
  curtain.dispatchEvent(event)
  expect(onDone).toHaveBeenCalledOnce()
})
