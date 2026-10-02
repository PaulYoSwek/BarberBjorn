import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { LanguageProvider, readInitialLang, useLang } from './language'

test('query wins over storage, storage wins over Dutch', () => {
  expect(readInitialLang('?lang=en', 'nl')).toBe('en')
  expect(readInitialLang('', 'en')).toBe('en')
  expect(readInitialLang('?lang=nope', 'nope')).toBe('nl')
})

function Probe() {
  const { lang, setLang, t } = useLang()
  return (
    <div>
      <p>{t.tagline}</p>
      <p>{lang}</p>
      <button type="button" onClick={() => setLang('en')}>
        EN
      </button>
    </div>
  )
}

test('switching to English updates the sentence, the url, and the document', async () => {
  window.history.replaceState(null, '', '/')
  localStorage.clear()
  render(
    <LanguageProvider>
      <Probe />
    </LanguageProvider>,
  )
  expect(screen.getByText('Een goede knip. Zonder haast.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'EN' }))
  expect(screen.getByText('A proper cut. No rush.')).toBeInTheDocument()
  expect(document.documentElement.lang).toBe('en')
  expect(localStorage.getItem('barber-lang')).toBe('en')
  expect(window.location.search).toBe('?lang=en')
})
