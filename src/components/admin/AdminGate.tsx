import { useState, type FormEvent } from 'react'
import { storeAdminSession } from '../../admin-session'
import { adminLogin } from '../../planning-api'

type Props = { onSuccess: () => void }

async function postLogin(path: string, password: string): Promise<boolean> {
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (!response.ok) return false
    const body = (await response.json()) as { ok?: unknown }
    return body.ok === true
  } catch {
    return false
  }
}

/**
 * Only used when the Supabase login function cannot be reached: the Vite dev
 * server (/__admin-login) or the Vercel route (/api/admin-login) checks
 * ADMIN_PASSWORD. Dashboard data still needs the Supabase session.
 */
async function fallbackLogin(password: string): Promise<boolean> {
  return (await postLogin('/__admin-login', password)) || (await postLogin('/api/admin-login', password))
}

export function AdminGate({ onSuccess }: Props) {
  const [password, setPassword] = useState('')
  const [wrong, setWrong] = useState(false)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    // Password managers can fill the field without firing React's change event.
    const typed = new FormData(event.currentTarget).get('password')
    const secret = typeof typed === 'string' && typed ? typed : password
    setBusy(true)
    try {
      const result = await adminLogin(secret)
      if (result === 'ok') {
        onSuccess()
        return
      }
      if (result === 'wrong') {
        setWrong(true)
        return
      }
      if (await fallbackLogin(secret)) {
        storeAdminSession(null)
        onSuccess()
        return
      }
      setWrong(true)
    } catch {
      setWrong(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-gate">
      <form className="admin-gate-card" onSubmit={onSubmit}>
        <div className="admin-gate-brand">
          <img className="admin-gate-word" src="/logo-wordmark.png?v=3" alt="Bjorn’s Barber" width="220" height="209" />
          <span className="admin-gate-rule" aria-hidden="true" />
          <p className="admin-gate-kicker">Dashboard</p>
        </div>
        <p className="admin-gate-lead">Planning en afspraken</p>
        <label>
          Wachtwoord
          <input
            type="password"
            name="password"
            value={password}
            autoComplete="current-password"
            enterKeyHint="go"
            onChange={(event) => {
              setWrong(false)
              setPassword(event.target.value)
            }}
            onInput={(event) => setPassword(event.currentTarget.value)}
          />
        </label>
        {wrong ? <p role="alert">Onjuist wachtwoord.</p> : null}
        <button type="submit" disabled={busy}>
          {busy ? 'Even geduld…' : 'Inloggen'}
        </button>
      </form>
      <a className="admin-gate-site" href="/">Naar de website</a>
    </div>
  )
}
