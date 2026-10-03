import { useState, type FormEvent } from 'react'
import { supabase } from '../../supabase'

type Props = { onSuccess: () => void }

function statusOf(error: unknown): number | null {
  if (!error || typeof error !== 'object' || !('context' in error)) return null
  const context = (error as { context?: { status?: unknown } }).context
  return typeof context?.status === 'number' ? context.status : null
}

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

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      if (supabase) {
        const { error } = await supabase.functions.invoke('admin-login', {
          body: { password },
        })
        if (!error) {
          sessionStorage.setItem('barber-admin', '1')
          onSuccess()
          return
        }
        if (statusOf(error) === 401) {
          setWrong(true)
          return
        }
      }
      if (await localLogin(password)) {
        sessionStorage.setItem('barber-admin', '1')
        onSuccess()
        return
      }
    } catch {
      /* stay on the gate */
    }
    setWrong(true)
  }

  return (
    <div className="admin-gate">
      <form className="admin-gate-card" onSubmit={onSubmit}>
        <div className="admin-gate-brand">
          <img className="admin-gate-word" src="/logo-wordmark.png?v=2" alt="BarberBjorn" />
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
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {wrong ? <p role="alert">Onjuist wachtwoord.</p> : null}
        <button type="submit">Inloggen</button>
      </form>
    </div>
  )
}
