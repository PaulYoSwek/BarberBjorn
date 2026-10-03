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
    <form
      onSubmit={onSubmit}
      style={{
        display: 'grid',
        gap: 12,
        maxWidth: 360,
        margin: '15vh auto',
        padding: 24,
      }}
    >
      <label style={{ display: 'grid', gap: 6 }}>
        Wachtwoord
        <input
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={(event) => setPassword(event.target.value)}
          style={{ minHeight: 44, padding: '0 12px' }}
        />
      </label>
      {wrong ? <p style={{ margin: 0 }}>Onjuist wachtwoord.</p> : null}
      <button type="submit" style={{ minHeight: 44 }}>
        Inloggen
      </button>
    </form>
  )
}
