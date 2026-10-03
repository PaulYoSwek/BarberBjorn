import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import App from '../App'
import { LanguageProvider } from '../language'

const { invoke, clientBox } = vi.hoisted(() => {
  const invoke = vi.fn()
  return {
    invoke,
    clientBox: {
      current: { functions: { invoke } } as { functions: { invoke: typeof invoke } } | null,
    },
  }
})

vi.mock('../supabase', () => ({
  get supabase() {
    return clientBox.current
  },
}))

function renderAt(path: string) {
  window.history.replaceState(null, '', path)
  render(
    <BrowserRouter>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </BrowserRouter>,
  )
}

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  invoke.mockReset()
  clientBox.current = { functions: { invoke } }
})

test('admin without a session shows the password gate', () => {
  window.history.replaceState(null, '', '/admin')
  sessionStorage.clear()
  render(
    <BrowserRouter>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </BrowserRouter>,
  )
  expect(screen.getByLabelText('Wachtwoord')).toBeInTheDocument()
  expect(screen.queryByText('Agenda')).not.toBeInTheDocument()
})

test('a stored session skips the password gate', () => {
  sessionStorage.setItem('barber-admin', '1')
  renderAt('/admin')
  expect(screen.getByText('Agenda')).toBeInTheDocument()
  expect(screen.queryByLabelText('Wachtwoord')).not.toBeInTheDocument()
})

test('a correct password opens the agenda and stores the session', async () => {
  invoke.mockResolvedValue({ data: { ok: true }, error: null })
  renderAt('/admin')
  await userEvent.type(screen.getByLabelText('Wachtwoord'), 'geheim')
  await userEvent.click(screen.getByRole('button', { name: 'Inloggen' }))
  expect(await screen.findByText('Agenda')).toBeInTheDocument()
  expect(sessionStorage.getItem('barber-admin')).toBe('1')
  expect(invoke).toHaveBeenCalledWith('admin-login', { body: { password: 'geheim' } })
})

test('a wrong password stays on the gate', async () => {
  invoke.mockResolvedValue({ data: null, error: new Error('unauthorized') })
  renderAt('/admin')
  await userEvent.type(screen.getByLabelText('Wachtwoord'), 'nee')
  await userEvent.click(screen.getByRole('button', { name: 'Inloggen' }))
  expect(await screen.findByText('Onjuist wachtwoord.')).toBeInTheDocument()
  expect(screen.getByLabelText('Wachtwoord')).toBeInTheDocument()
  expect(screen.queryByText('Agenda')).not.toBeInTheDocument()
  expect(sessionStorage.getItem('barber-admin')).not.toBe('1')
})

test('login without a supabase client stays on the gate', async () => {
  clientBox.current = null
  renderAt('/admin')
  await userEvent.type(screen.getByLabelText('Wachtwoord'), 'geheim')
  await userEvent.click(screen.getByRole('button', { name: 'Inloggen' }))
  expect(await screen.findByText('Onjuist wachtwoord.')).toBeInTheDocument()
  expect(screen.getByLabelText('Wachtwoord')).toBeInTheDocument()
  expect(sessionStorage.getItem('barber-admin')).not.toBe('1')
  expect(invoke).not.toHaveBeenCalled()
})
