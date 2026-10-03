import { useEffect, useRef, useState } from 'react'
import { loadInbox, type InboxRow } from '../../planning-api'
import { DEMO_INBOX } from './admin-defaults'
import { AdminAgenda } from './AdminAgenda'
import { AdminInbox } from './AdminInbox'
import { AdminMail } from './AdminMail'
import { AdminSettings } from './AdminSettings'

type Tab = 'agenda' | 'inbox' | 'mail' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'agenda', label: 'Agenda' },
  { id: 'inbox', label: 'Inbox' },
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
  const [inboxError, setInboxError] = useState<string | null>(null)
  const [mailClientId, setMailClientId] = useState<string | null>(null)
  const inboxGeneration = useRef(0)
  const decidedStatus = useRef(new Map<string, 'confirmed' | 'declined'>())

  function pullInbox(reportError: boolean) {
    const generation = ++inboxGeneration.current
    loadInbox()
      .then((next) => {
        if (generation !== inboxGeneration.current) return
        setRows(applyInbox(next, decidedStatus.current))
        setInboxError(null)
      })
      .catch(() => {
        if (reportError && generation === inboxGeneration.current) setInboxError('Inbox laden mislukt.')
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
    return () => {
      inboxGeneration.current += 1
    }
  }, [])

  const displayRows = rows.length > 0 ? rows : DEMO_INBOX
  const pendingCount = pending ?? displayRows.filter((row) => row.status === 'pending').length

  return (
    <div className="admin">
      <header className="admin-bar">
        <div className="admin-brand">
          <img className="admin-brand-mark" src="/logo-mark.png?v=2" alt="BarberBjorn" />
          <span className="admin-brand-name">BarberBjorn</span>
        </div>
        <nav className="admin-tabs">
        {TABS.map((item) => {
          const on = tab === item.id
          const label = item.id === 'inbox' && pendingCount > 0 ? `Inbox ${pendingCount}` : item.label
          return (
            <button
              key={item.id}
              type="button"
              className={on ? 'is-on' : undefined}
              aria-current={on ? 'page' : undefined}
              onClick={() => setTab(item.id)}
            >
              {label}
            </button>
          )
        })}
        </nav>
        <button type="button" className="admin-logout" onClick={onLogout}>
          Uitloggen
        </button>
      </header>
      <div className="admin-card">
        {tab === 'agenda' ? <AdminAgenda clients={displayRows} /> : null}
        {tab === 'inbox' ? (
          <AdminInbox
            rows={displayRows}
            error={rows.length > 0 ? inboxError : null}
            onChanged={onDecided}
            onResend={(id) => {
              setMailClientId(id)
              setTab('mail')
            }}
          />
        ) : null}
        {tab === 'mail' ? <AdminMail rows={displayRows} clientId={mailClientId} onSent={markMailSent} /> : null}
        {tab === 'settings' ? <AdminSettings /> : null}
      </div>
    </div>
  )
}
