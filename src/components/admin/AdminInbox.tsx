import { useState } from 'react'
import { decideInbox, type InboxRow } from '../../planning-api'
import { serviceName } from './admin-defaults'

const STATUS_ORDER: Record<InboxRow['status'], number> = {
  pending: 0,
  confirmed: 1,
  declined: 2,
}

const STATUS_LABEL: Record<InboxRow['status'], string> = {
  pending: 'In afwachting',
  confirmed: 'Bevestigd',
  declined: 'Geweigerd',
}

type Props = {
  rows: InboxRow[]
  error?: string | null
  onChanged: () => void
  onResend: (id: string) => void
}

function ordered(rows: InboxRow[]): InboxRow[] {
  return rows.slice().sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.start.localeCompare(b.start))
}

function when(start: string): string {
  return `${start.slice(0, 10)} ${start.slice(11, 16)}`
}

export function AdminInbox({ rows, error, onChanged, onResend }: Props) {
  const [notice, setNotice] = useState<string | null>(null)

  async function decide(id: string, action: 'accept' | 'decline') {
    try {
      const result = await decideInbox(id, action)
      if (!result.ok) {
        setNotice('Beslissen mislukt.')
        return
      }
      setNotice(null)
      onChanged()
    } catch {
      setNotice('Beslissen mislukt.')
    }
  }

  return (
    <div className="admin-inbox">
      {error ? <p role="alert">{error}</p> : null}
      {notice ? <p role="alert">{notice}</p> : null}
      <ul className="admin-list">
        {ordered(rows).map((row) => (
          <li key={row.id} className="admin-row">
            <p>{row.name}</p>
            <p>{serviceName(row.service)}</p>
            <p>{row.email}</p>
            {row.phone ? <p>{row.phone}</p> : null}
            <p>{when(row.start)}</p>
            <p>{STATUS_LABEL[row.status]}</p>
            {row.mail_sent ? null : <p>Mail niet gegaan</p>}
            {row.status === 'pending' || !row.mail_sent ? (
              <div className="admin-actions">
                {row.status === 'pending' ? (
                  <>
                    <button type="button" className="admin-primary" onClick={() => { void decide(row.id, 'accept') }}>
                      Accepteer
                    </button>
                    <button type="button" onClick={() => { void decide(row.id, 'decline') }}>
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
