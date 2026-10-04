import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
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

afterEach(() => {
  vi.unstubAllGlobals()
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
  expect(screen.getByRole('img', { name: 'BarberBjorn' })).toBeInTheDocument()
  expect(screen.getByText('Dashboard')).toBeInTheDocument()
  expect(screen.getByLabelText('Wachtwoord')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Naar de website' })).toHaveAttribute('href', '/')
  expect(screen.queryByText('Agenda')).not.toBeInTheDocument()
})

test('a stored session skips the password gate', () => {
  sessionStorage.setItem('barber-admin', '1')
  renderAt('/admin')
  expect(screen.getByText('Agenda')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Naar de website' })).toHaveAttribute('href', '/')
  expect(screen.queryByLabelText('Wachtwoord')).not.toBeInTheDocument()
})

test('uitloggen returns to the password gate', async () => {
  sessionStorage.setItem('barber-admin', '1')
  renderAt('/admin')
  expect(screen.getByText('Agenda')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Uitloggen' }))
  expect(screen.getByLabelText('Wachtwoord')).toBeInTheDocument()
  expect(screen.queryByText('Agenda')).not.toBeInTheDocument()
  expect(sessionStorage.getItem('barber-admin')).not.toBe('1')
})

test('an autofilled password still logs in', async () => {
  invoke.mockResolvedValue({ data: { ok: true }, error: null })
  renderAt('/admin')
  const field = screen.getByLabelText('Wachtwoord')
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(field, 'geheim')
  await userEvent.click(screen.getByRole('button', { name: 'Inloggen' }))
  expect(await screen.findByText('Agenda')).toBeInTheDocument()
  expect(invoke).toHaveBeenCalledWith('admin-login', { body: { password: 'geheim' } })
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
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
  renderAt('/admin')
  await userEvent.type(screen.getByLabelText('Wachtwoord'), 'geheim')
  await userEvent.click(screen.getByRole('button', { name: 'Inloggen' }))
  expect(await screen.findByText('Onjuist wachtwoord.')).toBeInTheDocument()
  expect(screen.getByLabelText('Wachtwoord')).toBeInTheDocument()
  expect(sessionStorage.getItem('barber-admin')).not.toBe('1')
  expect(invoke).not.toHaveBeenCalled()
})

test('a missing login function falls back to the local login route', async () => {
  invoke.mockResolvedValue({
    data: null,
    error: { message: 'not found', context: { status: 404 } },
  })
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
  vi.stubGlobal('fetch', fetchMock)
  renderAt('/admin')
  await userEvent.type(screen.getByLabelText('Wachtwoord'), 'geheim')
  await userEvent.click(screen.getByRole('button', { name: 'Inloggen' }))
  expect(await screen.findByText('Agenda')).toBeInTheDocument()
  expect(sessionStorage.getItem('barber-admin')).toBe('1')
  expect(fetchMock).toHaveBeenCalledWith(
    '/__admin-login',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ password: 'geheim' }),
    }),
  )
})

test('a missing login function falls back to the production login route', async () => {
  invoke.mockResolvedValue({
    data: null,
    error: { message: 'not found', context: { status: 404 } },
  })
  const fetchMock = vi.fn(async (url: string) => {
    if (url === '/api/admin-login') return { ok: true, json: async () => ({ ok: true }) }
    return { ok: false, status: 405, json: async () => ({ ok: false }) }
  })
  vi.stubGlobal('fetch', fetchMock)
  renderAt('/admin')
  await userEvent.type(screen.getByLabelText('Wachtwoord'), 'geheim')
  await userEvent.click(screen.getByRole('button', { name: 'Inloggen' }))
  expect(await screen.findByText('Agenda')).toBeInTheDocument()
  expect(sessionStorage.getItem('barber-admin')).toBe('1')
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/admin-login',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ password: 'geheim' }),
    }),
  )
})
