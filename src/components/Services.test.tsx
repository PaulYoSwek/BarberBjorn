import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { LanguageProvider } from '../language'
import { Services } from './Services'

test('lists the three prices with the combo marked', () => {
  render(<LanguageProvider><Services /></LanguageProvider>)
  expect(screen.getByText('€30')).toBeInTheDocument()
  expect(screen.getByText('€15')).toBeInTheDocument()
  expect(screen.getByText('€40')).toBeInTheDocument()
  expect(document.querySelector('.is-both')).toHaveTextContent('Allebei')
})
