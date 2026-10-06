import { useEffect, useRef, useState } from 'react'
import { isUnauthorized, loadInbox, type InboxRow } from '../../planning-api'
import { AdminAgenda } from './AdminAgenda'
import { AdminClients } from './AdminClients'
import { AdminInbox } from './AdminInbox'
import { AdminMail } from './AdminMail'
import { AdminSettings } from './AdminSettings'

type Tab = 'agenda' | 'inbox' | 'klanten' | 'mail' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'agenda', label: 'Agenda' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'klanten', label: 'Klanten' },
  { id: 'mail', label: 'Mail' },
  { id: 'settings', label: 'Settings' },
]

type Props = { pending?: number; onLogout?: () => void }

function applyInbox(incoming: InboxRow[], decided: ReadonlyMap<string, 'confirmed' | 'declined'>): InboxRow[] {
  return incoming.map((row) => {
    const status = decided.get(row.id)
    if (status && row.status === 'pending') return { ...row, status }
    return row
  })
}

export function AdminShell({ pending, onLogout }: Props) {
  const [tab, setTab] = useState<Tab>('agenda')
  const [rows, setRows] = useState<InboxRow[]>([])
  const [inboxLoaded, setInboxLoaded] = useState(false)
  const [inboxError, setInboxError] = useState<string | null>(null)
  const [mailClientId, setMailClientId] = useState<string | null>(null)
  const inboxGeneration = useRef(0)
  const decidedStatus = useRef(new Map<string, 'confirmed' | 'declined'>())
  const logout = useRef(onLogout)
  useEffect(() => {
    logout.current = onLogout
  }, [onLogout])

  function pullInbox(reportError: boolean) {
    const generation = ++inboxGeneration.current
    loadInbox()
      .then((next) => {
        if (generation !== inboxGeneration.current) return
        setRows(applyInbox(next, decidedStatus.current))
        setInboxError(null)
        setInboxLoaded(true)
      })
      .catch((error: unknown) => {
        if (generation !== inboxGeneration.current) return
        // The session cookie or token ran out: back to the password screen.
        if (isUnauthorized(error)) {
          logout.current?.()
          return
        }
        if (reportError) {
          setInboxError('Inbox laden mislukt.')
          setInboxLoaded(true)
        }
      })
  }

  function onDecided(id: string, status: 'confirmed' | 'declined') {
    decidedStatus.current.set(id, status)
    setRows((current) => current.map((row) => (row.id === id ? { ...row, status } : row)))
    pullInbox(false)
  }

  function markMailSent(id: string) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, mail_sent: true } : row)))
  }

  useEffect(() => {
    pullInbox(true)
    const onVisible = () => {
      if (document.visibilityState === 'visible') pullInbox(false)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      inboxGeneration.current += 1
    }
  }, [])

  const pendingCount = pending ?? rows.filter((row) => row.status === 'pending').length

  return (
    <div className="admin">
      <header className="admin-bar">
        <div className="admin-brand">
          <img className="admin-brand-mark" src="/logo-mark.png?v=2" alt="BarberBjorn" width="28" height="28" />
          <span className="admin-brand-name">BarberBjorn</span>
        </div>
        <nav className="admin-tabs" aria-label="Dashboard">
          {TABS.map((item) => {
            const on = tab === item.id
            const badge = item.id === 'inbox' && pendingCount > 0 ? pendingCount : 0
            return (
              <button
                key={item.id}
                type="button"
                className={on ? 'is-on' : undefined}
                aria-current={on ? 'page' : undefined}
                aria-label={badge ? `Inbox ${badge}` : undefined}
                onClick={() => setTab(item.id)}
              >
                {item.label}
                {badge ? <span className="admin-badge" aria-hidden="true">{badge}</span> : null}
              </button>
            )
          })}
        </nav>
        <div className="admin-bar-end">
          <a className="admin-site" href="/">Naar de website</a>
          <button type="button" className="admin-logout" onClick={onLogout}>
            Uitloggen
          </button>
        </div>
      </header>
      <div className="admin-card">
        {tab === 'agenda' ? <AdminAgenda clients={rows} /> : null}
        {tab === 'inbox' ? (
          <AdminInbox
            rows={rows}
            loading={!inboxLoaded}
            error={inboxError}
            onChanged={onDecided}
            onResend={(id) => {
              setMailClientId(id)
              setTab('mail')
            }}
          />
        ) : null}
        {tab === 'klanten' ? <AdminClients rows={rows} /> : null}
        {tab === 'mail' ? <AdminMail rows={rows} clientId={mailClientId} onSent={markMailSent} /> : null}
        {tab === 'settings' ? <AdminSettings /> : null}
      </div>
    </div>
  )
}
