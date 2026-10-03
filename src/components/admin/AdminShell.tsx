import { useEffect, useState } from 'react'
import { loadInbox, type InboxRow } from '../../planning-api'
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

type Props = { pending?: number }

export function AdminShell({ pending }: Props) {
  const [tab, setTab] = useState<Tab>('agenda')
  const [rows, setRows] = useState<InboxRow[]>([])
  const [inboxError, setInboxError] = useState<string | null>(null)
  const [mailClientId, setMailClientId] = useState<string | null>(null)

  function refresh() {
    loadInbox()
      .then(setRows)
      .catch(() => {})
  }

  useEffect(() => {
    let cancelled = false
    loadInbox()
      .then((next) => {
        if (cancelled) return
        setRows(next)
        setInboxError(null)
      })
      .catch(() => {
        if (!cancelled) setInboxError('Inbox laden mislukt.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const pendingCount = pending ?? rows.filter((row) => row.status === 'pending').length

  return (
    <div className="admin">
      <div className="admin-card">
        {tab === 'agenda' ? <AdminAgenda /> : null}
        {tab === 'inbox' ? (
          <AdminInbox
            rows={rows}
            error={inboxError}
            onChanged={refresh}
            onResend={(id) => {
              setMailClientId(id)
              setTab('mail')
            }}
          />
        ) : null}
        {tab === 'mail' ? <AdminMail rows={rows} clientId={mailClientId} /> : null}
        {tab === 'settings' ? <AdminSettings /> : null}
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
    </div>
  )
}
