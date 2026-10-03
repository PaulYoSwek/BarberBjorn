import { useState, type FormEvent } from 'react'
import { supabase } from '../../supabase'

type Props = { onSuccess: () => void }

export function AdminGate({ onSuccess }: Props) {
  const [password, setPassword] = useState('')
  const [wrong, setWrong] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) {
      setWrong(true)
      return
    }
    try {
      const { error } = await supabase.functions.invoke('admin-login', {
        body: { password },
      })
      if (error) {
        setWrong(true)
        return
      }
      sessionStorage.setItem('barber-admin', '1')
      onSuccess()
    } catch {
      setWrong(true)
    }
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
