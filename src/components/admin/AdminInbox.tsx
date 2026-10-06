import { useRef, useState, type FormEvent } from 'react'
import { copy } from '../../content'
import { decideInbox, moveBooking, type InboxRow } from '../../planning-api'
import { serviceName } from './admin-defaults'

const STATUS_LABEL: Record<InboxRow['status'], string> = {
  pending: 'Nieuw',
  confirmed: 'Bevestigd',
  declined: 'Geweigerd',
}

type Props = {
  rows: InboxRow[]
  loading?: boolean
  error?: string | null
  onChanged: (id: string, status: 'confirmed' | 'declined') => void
  onResend: (id: string) => void
  onMoved?: (id: string, start: string, sent: boolean) => void
}

const MOVE_ERRORS: Record<string, string> = {
  overlap: 'Die tijd is al bezet door een andere afspraak. Kies een ander moment.',
  past: 'Kies een moment in de toekomst.',
  invalid: 'Kies een dag en een tijd.',
}

function stampOf(start: string): string {
  const date = start.slice(0, 10)
  const weekday = WEEKDAY_KEYS[new Date(`${date}T12:00:00`).getDay()]
  const day = copy.nl.days.find((item) => item.key === weekday)?.label ?? ''
  return `${day} ${Number(date.slice(8, 10))} ${copy.nl.monthShort[Number(date.slice(5, 7)) - 1]} om ${start.slice(11, 16)}`
}

type Group = { id: string; title: string; rows: InboxRow[] }

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

function wallNow(): string {
  const now = new Date()
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:00`
}

/** New requests first, then what is coming, then what happened, then declined. */
function grouped(rows: InboxRow[]): Group[] {
  const now = wallNow()
  const byStart = (a: InboxRow, b: InboxRow) => a.start.localeCompare(b.start)
  const confirmed = rows.filter((row) => row.status === 'confirmed')
  const groups: Group[] = [
    { id: 'pending', title: 'Te beoordelen', rows: rows.filter((row) => row.status === 'pending').sort(byStart) },
    { id: 'upcoming', title: 'Komend', rows: confirmed.filter((row) => row.start >= now).sort(byStart) },
    { id: 'past', title: 'Geweest', rows: confirmed.filter((row) => row.start < now).sort((a, b) => byStart(b, a)) },
    {
      id: 'declined',
      title: 'Geweigerd',
      rows: rows.filter((row) => row.status === 'declined').sort((a, b) => byStart(b, a)),
    },
  ]
  return groups.filter((group) => group.rows.length > 0)
}

function DateTile({ start }: { start: string }) {
  const date = start.slice(0, 10)
  const weekday = WEEKDAY_KEYS[new Date(`${date}T12:00:00`).getDay()]
  const day = copy.nl.days.find((item) => item.key === weekday)?.label ?? ''
  const month = copy.nl.monthShort[Number(date.slice(5, 7)) - 1]
  return (
    <div className="inbox-date" aria-label={`${day} ${Number(date.slice(8, 10))} ${month} ${start.slice(11, 16)}`}>
      <span>{day}</span>
      <strong>{Number(date.slice(8, 10))}</strong>
      <span>{month}</span>
      <em>{start.slice(11, 16)}</em>
    </div>
  )
}

function MailIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M1.5 3.5h13v9h-13z M1.5 4l6.5 5 6.5-5" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M4.2 1.8 6 4.6 4.8 6.2a8.4 8.4 0 0 0 5 5l1.6-1.2 2.8 1.8-.8 2.4c-6.3.4-12-5.3-11.6-11.6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function AdminInbox({ rows, loading = false, error, onChanged, onResend, onMoved }: Props) {
  const [notice, setNotice] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [decidingId, setDecidingId] = useState<string | null>(null)
  const decidingRef = useRef<string | null>(null)
  const [moving, setMoving] = useState<{ id: string; date: string; time: string } | null>(null)
  const [movingBusy, setMovingBusy] = useState(false)

  function startMove(row: InboxRow) {
    setNotice(null)
    setDone(null)
    setMoving({ id: row.id, date: row.start.slice(0, 10), time: row.start.slice(11, 16) })
  }

  async function submitMove(event: FormEvent<HTMLFormElement>, row: InboxRow) {
    event.preventDefault()
    if (!moving || movingBusy) return
    if (!moving.date || !/^\d{2}:\d{2}/.test(moving.time)) {
      setNotice(MOVE_ERRORS.invalid)
      return
    }
    const start = `${moving.date}T${moving.time.slice(0, 5)}:00`
    setMovingBusy(true)
    try {
      const result = await moveBooking(row.id, start)
      if (!result.ok) {
        setNotice(MOVE_ERRORS[result.error] ?? 'Verplaatsen mislukt. Probeer het nog eens.')
        return
      }
      setNotice(null)
      setMoving(null)
      setDone(
        result.sent
          ? `${row.name} staat nu op ${stampOf(start)}. De klant heeft een mail gekregen.`
          : `${row.name} staat nu op ${stampOf(start)}. De mail kon niet worden verstuurd; gebruik Opnieuw mailen.`,
      )
      onMoved?.(row.id, start, result.sent)
    } finally {
      setMovingBusy(false)
    }
  }

  async function decide(id: string, action: 'accept' | 'decline') {
    if (decidingRef.current) return
    decidingRef.current = id
    setDecidingId(id)
    try {
      const result = await decideInbox(id, action)
      if (!result.ok) {
        setNotice(
          result.error === 'overlap' ? 'Die tijd is al bezet. Kies een andere tijd of weiger.' : 'Beslissen mislukt.',
        )
        return
      }
      setNotice(null)
      setDone(action === 'accept' ? 'Geaccepteerd. De klant krijgt een mail.' : 'Geweigerd. De klant krijgt een mail.')
      onChanged(id, action === 'accept' ? 'confirmed' : 'declined')
    } catch {
      setNotice('Beslissen mislukt.')
    } finally {
      decidingRef.current = null
      setDecidingId(null)
    }
  }

  const pendingCount = rows.filter((row) => row.status === 'pending').length
  const groups = grouped(rows)

  return (
    <div className="admin-inbox">
      <header className="admin-agenda-head">
        <div>
          <p className="admin-kicker">Afspraken</p>
          <h1>Inbox</h1>
        </div>
        <p className={`inbox-count${pendingCount > 0 ? ' is-new' : ''}`}>
          {pendingCount === 0 ? 'Alles bij' : `${pendingCount} nieuw`}
        </p>
      </header>
      {error ? <p role="alert">{error}</p> : null}
      {notice ? <p role="alert">{notice}</p> : null}
      {done ? (
        <p className="admin-done" role="status">
          {done}
        </p>
      ) : null}
      {loading && rows.length === 0 && !error ? <p className="admin-hint">Inbox laden…</p> : null}
      {!loading && rows.length === 0 && !error ? (
        <p className="admin-hint">Nog geen afspraken. Nieuwe boekingen verschijnen hier vanzelf.</p>
      ) : null}
      {groups.map((group) => (
        <section key={group.id} className="inbox-group" aria-label={group.title}>
          <h2 className="inbox-group-title">
            {group.title} <span>{group.rows.length}</span>
          </h2>
          <ul className="inbox-list">
            {group.rows.map((row) => {
              // A pending request gets its mail when Bjorn decides, so it is not "unsent" yet.
              const unsent = row.status !== 'pending' && !row.mail_sent
              const movable = group.id !== 'past'
              const isMoving = moving?.id === row.id
              return (
                <li key={row.id} className={`inbox-card is-${row.status}`}>
                  <DateTile start={row.start} />
                  <div className="inbox-body">
                    <div className="inbox-top">
                      <h3>{row.name}</h3>
                      <span className="inbox-status">{STATUS_LABEL[row.status]}</span>
                    </div>
                    <p className="inbox-tags">
                      <span className="inbox-tag is-service">
                        {serviceName(row.service)} · {row.minutes} min
                      </span>
                      {row.price ? <span className="inbox-tag">{row.price}</span> : null}
                      {row.kind === 'custom' ? <span className="inbox-tag is-custom">Ander tijdstip</span> : null}
                    </p>
                    <p className="inbox-contact">
                      <a href={`mailto:${row.email}`}>
                        <MailIcon />
                        {row.email}
                      </a>
                      {row.phone ? (
                        <a href={`tel:${row.phone.replace(/\s+/g, '')}`}>
                          <PhoneIcon />
                          {row.phone}
                        </a>
                      ) : null}
                    </p>
                    {isMoving && moving ? (
                      <form
                        className="inbox-move"
                        aria-label={`${row.name} verplaatsen`}
                        onSubmit={(event) => {
                          void submitMove(event, row)
                        }}
                      >
                        <label>
                          Nieuwe dag
                          <input
                            type="date"
                            value={moving.date}
                            onChange={(event) => setMoving({ ...moving, date: event.target.value })}
                          />
                        </label>
                        <label>
                          Tijd
                          <input
                            type="time"
                            step={300}
                            value={moving.time}
                            onChange={(event) => setMoving({ ...moving, time: event.target.value })}
                          />
                        </label>
                        <div className="inbox-move-actions">
                          <button type="submit" className="inbox-accept" disabled={movingBusy}>
                            {movingBusy ? 'Verplaatsen…' : 'Verplaats en mail'}
                          </button>
                          <button type="button" onClick={() => setMoving(null)}>
                            Annuleren
                          </button>
                        </div>
                      </form>
                    ) : null}
                    {!isMoving && (row.status === 'pending' || unsent || movable) ? (
                      <div className="inbox-actions">
                        {unsent ? <span className="inbox-warn">Mail niet gegaan</span> : null}
                        {row.status === 'pending' ? (
                          <>
                            <button
                              type="button"
                              className="inbox-accept"
                              disabled={decidingId === row.id}
                              onClick={() => {
                                void decide(row.id, 'accept')
                              }}
                            >
                              Accepteer
                            </button>
                            <button
                              type="button"
                              className="inbox-decline"
                              disabled={decidingId === row.id}
                              onClick={() => {
                                void decide(row.id, 'decline')
                              }}
                            >
                              Weiger
                            </button>
                          </>
                        ) : null}
                        {movable ? (
                          <button type="button" className="inbox-move-open" onClick={() => startMove(row)}>
                            Ander tijdstip
                          </button>
                        ) : null}
                        {unsent ? (
                          <button type="button" className="inbox-resend" onClick={() => onResend(row.id)}>
                            Opnieuw mailen
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
