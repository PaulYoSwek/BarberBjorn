import { useState, type FormEvent } from 'react'
import { storeAdminSession } from '../../admin-session'
import { adminLogin } from '../../planning-api'

type Props = { onSuccess: () => void }

/** Dev-only fallback: the Vite server checks ADMIN_PASSWORD from .env. */
async function localLogin(password: string): Promise<boolean> {
  try {
    const response = await fetch('/__admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    return response.ok
  } catch {
    return false
  }
}

export function AdminGate({ onSuccess }: Props) {
  const [password, setPassword] = useState('')
  const [wrong, setWrong] = useState(false)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      const result = await adminLogin(password)
      if (result === 'ok') {
        onSuccess()
        return
      }
      if (result === 'wrong') {
        setWrong(true)
        return
      }
      if (await localLogin(password)) {
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
          <img className="admin-gate-word" src="/logo-wordmark.png?v=2" alt="BarberBjorn" width="220" height="231" />
          <span className="admin-gate-rule" aria-hidden="true" />
          <p className="admin-gate-kicker">Dashboard</p>
        </div>
        <p className="admin-gate-lead">Planning en afspraken</p>
        <label>
          Wachtwoord
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(event) => {
              setWrong(false)
              setPassword(event.target.value)
            }}
          />
        </label>
        {wrong ? <p role="alert">Onjuist wachtwoord.</p> : null}
        <button type="submit" disabled={busy}>
          {busy ? 'Even geduld…' : 'Inloggen'}
        </button>
      </form>
    </div>
  )
}
