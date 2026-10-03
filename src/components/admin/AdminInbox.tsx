import { useRef, useState } from 'react'
import { copy } from '../../content'
import { decideInbox, type InboxRow } from '../../planning-api'
import { serviceName } from './admin-defaults'

const STATUS_ORDER: Record<InboxRow['status'], number> = {
  pending: 0,
  confirmed: 1,
  declined: 2,
}

const STATUS_LABEL: Record<InboxRow['status'], string> = {
  pending: 'Nieuw',
  confirmed: 'Bevestigd',
  declined: 'Geweigerd',
}

type Props = {
  rows: InboxRow[]
  error?: string | null
  onChanged: (id: string, status: 'confirmed' | 'declined') => void
  onResend: (id: string) => void
}

function ordered(rows: InboxRow[]): InboxRow[] {
  return rows.slice().sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.start.localeCompare(b.start))
}

function when(start: string): string {
  const month = copy.nl.monthShort[Number(start.slice(5, 7)) - 1]
  const day = Number(start.slice(8, 10))
  const weekday = new Date(`${start.slice(0, 10)}T12:00:00`).getDay()
  const keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
  const label = copy.nl.days.find((item) => item.key === keys[weekday])?.label ?? ''
  return `${label} ${day} ${month} · ${start.slice(11, 16)}`
}

export function AdminInbox({ rows, error, onChanged, onResend }: Props) {
  const [notice, setNotice] = useState<string | null>(null)
  const [decidingId, setDecidingId] = useState<string | null>(null)
  const decidingRef = useRef<string | null>(null)

  async function decide(id: string, action: 'accept' | 'decline') {
    if (decidingRef.current) return
    decidingRef.current = id
    setDecidingId(id)
    try {
      const result = await decideInbox(id, action)
      if (!result.ok) {
        setNotice('Beslissen mislukt.')
        return
      }
      setNotice(null)
      onChanged(id, action === 'accept' ? 'confirmed' : 'declined')
    } catch {
      setNotice('Beslissen mislukt.')
    } finally {
      decidingRef.current = null
      setDecidingId(null)
    }
  }

  const pendingCount = rows.filter((row) => row.status === 'pending').length

  return (
    <div className="admin-inbox">
      <header className="admin-agenda-head">
        <div>
          <p className="admin-kicker">Afspraken</p>
          <h1>Inbox</h1>
        </div>
        <p className="admin-inbox-count">
          {pendingCount === 0 ? 'Alles bij' : `${pendingCount} nieuw`}
        </p>
      </header>
      {error ? <p role="alert">{error}</p> : null}
      {notice ? <p role="alert">{notice}</p> : null}
      <ul className="admin-list">
        {ordered(rows).map((row) => (
          <li key={row.id} className={`admin-row admin-inbox-card is-${row.status}`}>
            <div className="admin-inbox-card-head">
              <h2>{row.name}</h2>
              <span className="admin-status">{STATUS_LABEL[row.status]}</span>
            </div>
            <p className="admin-inbox-when">{when(row.start)}</p>
            <dl className="admin-inbox-meta">
              <div>
                <dt>Dienst</dt>
                <dd>{serviceName(row.service)}</dd>
              </div>
              <div>
                <dt>Mail</dt>
                <dd>{row.email}</dd>
              </div>
              <div>
                <dt>Telefoon</dt>
                <dd>{row.phone || '—'}</dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{row.kind === 'custom' ? 'Ander tijdstip' : 'Slot'}</dd>
              </div>
            </dl>
            {row.mail_sent ? null : <p className="admin-inbox-mail">Mail niet gegaan</p>}
            {row.status === 'pending' || !row.mail_sent ? (
              <div className="admin-actions">
                {row.status === 'pending' ? (
                  <>
                    <button
                      type="button"
                      className="admin-primary"
                      disabled={decidingId === row.id}
                      onClick={() => {
                        void decide(row.id, 'accept')
                      }}
                    >
                      Accepteer
                    </button>
                    <button
                      type="button"
                      disabled={decidingId === row.id}
                      onClick={() => {
                        void decide(row.id, 'decline')
                      }}
                    >
                      Weiger
                    </button>
                  </>
                ) : null}
                {row.mail_sent ? null : (
                  <button type="button" onClick={() => onResend(row.id)}>
                    Opnieuw
                  </button>
                )}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
