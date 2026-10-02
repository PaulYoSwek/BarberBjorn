import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { LanguageProvider } from '../language'
import { LanguageSwitch } from './LanguageSwitch'

test('NL is pressed first and EN switches the language', async () => {
  window.history.replaceState(null, '', '/')
  localStorage.clear()
  render(
    <LanguageProvider>
      <LanguageSwitch />
    </LanguageProvider>,
  )
  expect(screen.getByRole('button', { name: 'NL' })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(screen.getByRole('button', { name: 'EN' }))
  expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true')
})

test('a hidden switch is not shown', () => {
  render(
    <LanguageProvider>
      <LanguageSwitch hidden />
    </LanguageProvider>,
  )
  expect(screen.queryByRole('button', { name: 'NL' })).not.toBeInTheDocument()
})
