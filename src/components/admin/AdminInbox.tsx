import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { copy, type ServiceId } from '../../content'
import { bookingMoney, formatMoney, type OrderItem, type Product } from '../../finance'
import { adminWrite, decideInbox, moveBooking, publishLiveSchedule, type InboxAction, type InboxRow } from '../../planning-api'
import { serviceName } from './admin-defaults'
import { AdminBookingDetail } from './AdminBookingDetail'
import { OrderEditor } from './OrderEditor'

const STATUS_LABEL: Record<InboxRow['status'], string> = {
  pending: 'Nieuw',
  confirmed: 'Bevestigd',
  declined: 'Geweigerd',
  noshow: 'Niet gekomen',
}

type Props = {
  rows: InboxRow[]
  loading?: boolean
  error?: string | null
  onChanged: (id: string, status: InboxRow['status']) => void
  onResend: (id: string) => void
  onMoved?: (id: string, start: string, sent: boolean) => void
  products?: Product[]
  prices?: Partial<Record<ServiceId, string>>
  onOrderSaved?: (id: string, charged: number | null, items: OrderItem[], paid?: boolean) => void
  /** The client paid, or the mark was taken back. */
  onPaid?: (id: string, paid: boolean) => void
  /** An appointment got another service. */
  onUpdated?: (row: InboxRow) => void
  /** An appointment was removed. */
  onRemoved?: (id: string) => void
}

const MOVE_ERRORS: Record<string, string> = {
  overlap: 'Die tijd is dicht of al bezet voor de hele afspraak. Kies een ander moment of zet de tijd eerst open.',
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

function pad(part: number): string {
  return String(part).padStart(2, '0')
}

function wallOf(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
}

/** Where an appointment stands right now: over, in the chair, or still to come. */
export type Moment = 'over' | 'now' | 'coming'

export function momentOf(row: Pick<InboxRow, 'start' | 'minutes'>, now = new Date()): Moment {
  const [date, time] = row.start.split('T')
  const [year, month, day] = date.split('-').map(Number)
  const [hours, minutes] = time.split(':').map(Number)
  const start = new Date(year, month - 1, day, hours, minutes)
  const end = new Date(start.getTime() + row.minutes * 60_000)
  if (end.getTime() <= now.getTime()) return 'over'
  if (start.getTime() <= now.getTime()) return 'now'
  return 'coming'
}

export type When = 'coming' | 'today' | 'over' | 'all'
export type InboxFilter = { when: When; status: '' | InboxRow['status'] | 'paid' | 'unpaid'; service: string; query: string }
export const DEFAULT_FILTER: InboxFilter = { when: 'coming', status: '', service: '', query: '' }

const WHEN_LABEL: Record<When, string> = {
  coming: 'Komend',
  today: 'Vandaag',
  over: 'Geweest',
  all: 'Alles',
}

function matchesWhen(row: InboxRow, when: When, now: Date): boolean {
  if (when === 'all') return true
  if (when === 'today') return row.start.slice(0, 10) === wallOf(now).slice(0, 10)
  const over = momentOf(row, now) === 'over'
  return when === 'over' ? over : !over
}

/** Everything but the when-filter, so the when-buttons can show their counts. */
function matchesRest(row: InboxRow, filter: InboxFilter): boolean {
  if (filter.status === 'paid') {
    if (row.status !== 'confirmed' || row.paid !== true) return false
  } else if (filter.status === 'unpaid') {
    if (row.status !== 'confirmed' || row.paid !== false) return false
  } else if (filter.status && row.status !== filter.status) return false
  if (filter.service && row.service !== filter.service) return false
  const query = filter.query.trim().toLowerCase()
  if (!query) return true
  const digits = query.replace(/\D/g, '')
  return (
    row.name.toLowerCase().includes(query) ||
    row.email.toLowerCase().includes(query) ||
    (digits.length >= 3 && row.phone.replace(/\D/g, '').includes(digits))
  )
}

export function filterInbox(rows: InboxRow[], filter: InboxFilter, now = new Date()): InboxRow[] {
  return rows.filter((row) => matchesWhen(row, filter.when, now) && matchesRest(row, filter))
}

/** New requests first, then what is coming, then what happened, then declined. */
function grouped(rows: InboxRow[], now: Date): Group[] {
  const byStart = (a: InboxRow, b: InboxRow) => a.start.localeCompare(b.start)
  const latestFirst = (a: InboxRow, b: InboxRow) => byStart(b, a)
  const over = (row: InboxRow) => momentOf(row, now) === 'over'
  const live = rows.filter((row) => row.status !== 'declined')
  const groups: Group[] = [
    { id: 'pending', title: 'Te beoordelen', rows: live.filter((row) => row.status === 'pending' && !over(row)).sort(byStart) },
    { id: 'upcoming', title: 'Komend', rows: live.filter((row) => row.status === 'confirmed' && !over(row)).sort(byStart) },
    { id: 'past', title: 'Geweest', rows: live.filter(over).sort(latestFirst) },
    { id: 'declined', title: 'Geweigerd', rows: rows.filter((row) => row.status === 'declined').sort(latestFirst) },
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

export function AdminInbox({
  rows,
  loading = false,
  error,
  onChanged,
  onResend,
  onMoved,
  products = [],
  prices = {},
  onOrderSaved,
  onUpdated,
  onRemoved,
  onPaid,
}: Props) {
  const [notice, setNotice] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [decidingId, setDecidingId] = useState<string | null>(null)
  const decidingRef = useRef<string | null>(null)
  const [moving, setMoving] = useState<{ id: string; date: string; time: string } | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [payingId, setPayingId] = useState<string | null>(null)
  // Payment shows once the database tracks it: rows then carry paid true or false.
  const tracksPayment = rows.some((row) => row.paid !== undefined)

  async function markPaid(row: InboxRow) {
    if (payingId) return
    setPayingId(row.id)
    setNotice(null)
    setDone(null)
    const result = await adminWrite({ type: 'bookingPaid', id: row.id, paid: true })
    setPayingId(null)
    if (!result.ok) return setNotice('Markeren als betaald mislukt. Probeer het nog eens.')
    setDone(`${row.name} heeft betaald: ${formatMoney(bookingMoney(row, prices).total)}. Telt nu mee in de omzet.`)
    onPaid?.(row.id, true)
  }
  const [movingBusy, setMovingBusy] = useState(false)
  const [filter, setFilter] = useState<InboxFilter>(DEFAULT_FILTER)

  useEffect(() => {
    if (!orderId) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOrderId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [orderId])

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

  const DECIDED: Record<InboxAction, { status: InboxRow['status']; done: string; failed: string }> = {
    accept: { status: 'confirmed', done: 'Geaccepteerd. De klant krijgt een mail.', failed: 'Beslissen mislukt.' },
    decline: { status: 'declined', done: 'Geweigerd. De klant krijgt een mail.', failed: 'Beslissen mislukt.' },
    noshow: { status: 'noshow', done: 'Gemarkeerd als niet gekomen. Telt niet mee in de omzet.', failed: 'Markeren mislukt.' },
    showed: { status: 'confirmed', done: 'Weer gemarkeerd als gekomen. Telt weer mee in de omzet.', failed: 'Markeren mislukt.' },
  }

  async function decide(id: string, action: InboxAction) {
    if (decidingRef.current) return
    decidingRef.current = id
    setDecidingId(id)
    const outcome = DECIDED[action]
    try {
      const result = await decideInbox(id, action)
      if (!result.ok) {
        setNotice(
          result.error === 'overlap' ? 'Die tijd is al bezet. Kies een andere tijd of weiger.' : outcome.failed,
        )
        return
      }
      setNotice(null)
      setDone(outcome.done)
      onChanged(id, outcome.status)
    } catch {
      setNotice(outcome.failed)
    } finally {
      decidingRef.current = null
      setDecidingId(null)
    }
  }

  const pendingCount = rows.filter((row) => row.status === 'pending').length
  const orderRow = orderId ? (rows.find((row) => row.id === orderId) ?? null) : null
  const editRow = editId ? (rows.find((row) => row.id === editId) ?? null) : null
  const now = new Date()
  const shown = filterInbox(rows, filter, now)
  const groups = grouped(shown, now)
  const whenCounts = (Object.keys(WHEN_LABEL) as When[]).map((when) => ({
    when,
    count: rows.filter((row) => matchesWhen(row, when, now) && matchesRest(row, filter)).length,
  }))
  const services = useMemo(() => [...new Set(rows.map((row) => row.service))].sort(), [rows])
  const filtered =
    filter.status !== DEFAULT_FILTER.status || filter.service !== '' || filter.query.trim() !== '' || filter.when !== DEFAULT_FILTER.when

  return (
    <div className="admin-inbox">
      <header className="admin-agenda-head">
        <div>
          <p className="admin-kicker">Overzicht</p>
          <h1>Afspraken</h1>
        </div>
        {pendingCount === 0 ? (
          <p className="inbox-count">Alles bij</p>
        ) : (
          <button
            type="button"
            className="inbox-count is-new"
            title="Toon alleen wat je nog moet beoordelen"
            onClick={() => setFilter({ ...DEFAULT_FILTER, when: 'all', status: 'pending' })}
          >
            {pendingCount} nieuw
          </button>
        )}
      </header>
      {rows.length > 0 ? (
        <div className="inbox-filters" role="search" aria-label="Filters">
          <div className="inbox-when" role="radiogroup" aria-label="Wanneer">
            {whenCounts.map(({ when, count }) => (
              <button
                key={when}
                type="button"
                role="radio"
                aria-checked={filter.when === when}
                onClick={() => setFilter({ ...filter, when })}
              >
                {WHEN_LABEL[when]} <span>{count}</span>
              </button>
            ))}
          </div>
          <div className="inbox-filter-row">
            <label>
              Status
              <select
                value={filter.status}
                onChange={(event) => setFilter({ ...filter, status: event.target.value as InboxFilter['status'] })}
              >
                <option value="">Alle</option>
                <option value="pending">Te beoordelen</option>
                <option value="confirmed">Bevestigd</option>
                <option value="noshow">Niet gekomen</option>
                <option value="declined">Geweigerd</option>
                {tracksPayment ? (
                  <>
                    <option value="unpaid">Nog niet betaald</option>
                    <option value="paid">Betaald</option>
                  </>
                ) : null}
              </select>
            </label>
            <label>
              Dienst
              <select value={filter.service} onChange={(event) => setFilter({ ...filter, service: event.target.value })}>
                <option value="">Alle</option>
                {services.map((id) => (
                  <option key={id} value={id}>
                    {serviceName(id)}
                  </option>
                ))}
              </select>
            </label>
            <label className="inbox-search">
              Zoeken
              <input
                type="search"
                value={filter.query}
                placeholder="Naam, e-mail of telefoon"
                onChange={(event) => setFilter({ ...filter, query: event.target.value })}
              />
            </label>
            {filtered ? (
              <button type="button" className="inbox-filter-clear" onClick={() => setFilter(DEFAULT_FILTER)}>
                Filters wissen
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      {notice ? <p role="alert">{notice}</p> : null}
      {done ? (
        <p className="admin-done" role="status">
          {done}
        </p>
      ) : null}
      {loading && rows.length === 0 && !error ? <p className="admin-hint">Afspraken laden…</p> : null}
      {!loading && rows.length === 0 && !error ? (
        <p className="admin-hint">Nog geen afspraken. Nieuwe boekingen verschijnen hier vanzelf.</p>
      ) : null}
      {rows.length > 0 && shown.length === 0 ? (
        <p className="admin-hint">
          Geen afspraken bij deze filters.{' '}
          {filter.when === 'coming' && !filter.status && !filter.service && !filter.query.trim()
            ? 'Er staat niets meer gepland.'
            : null}
        </p>
      ) : null}
      {editRow ? (
        <AdminBookingDetail
          row={editRow}
          stamp={stampOf(editRow.start).replace(/ om \d{2}:\d{2}$/, '')}
          onClose={() => setEditId(null)}
          onChanged={(row) => {
            setEditId(null)
            setNotice(null)
            setDone(`Dienst gewijzigd: ${row.name}, ${serviceName(row.service)}.`)
            publishLiveSchedule()
            onUpdated?.(row)
          }}
          onDeleted={(row) => {
            setEditId(null)
            setNotice(null)
            setDone(`Afspraak verwijderd: ${row.name}, ${stampOf(row.start)}.`)
            publishLiveSchedule()
            onRemoved?.(row.id)
          }}
        />
      ) : null}
      {orderRow ? (
        <div className="admin-modal" onClick={(event) => event.target === event.currentTarget && setOrderId(null)}>
          <div className="admin-bon-modal" role="dialog" aria-modal="true" aria-label={`Bon ${orderRow.name}`}>
            <OrderEditor
              row={orderRow}
              products={products}
              prices={prices}
              onClose={() => setOrderId(null)}
              onSaved={(id, charged, items, paid) => {
                setOrderId(null)
                const total = formatMoney(bookingMoney({ ...orderRow, charged, items }, prices).total)
                setDone(`Bon van ${orderRow.name} opgeslagen: ${total}${paid === true ? ', betaald' : paid === false ? ', nog niet betaald' : ''}.`)
                onOrderSaved?.(id, charged, items, paid)
              }}
            />
          </div>
        </div>
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
              const moment = momentOf(row, now)
              const over = moment === 'over'
              const movable = !over
              const expired = over && row.status === 'pending'
              const isMoving = moving?.id === row.id
              const today = row.start.slice(0, 10) === wallOf(now).slice(0, 10)
              return (
                <li key={row.id} className={`inbox-card is-${row.status}${over ? ' is-over' : ''}${row.status === 'confirmed' && row.paid === false && over ? ' is-due' : ''}${moment === 'now' ? ' is-now' : ''}`}>
                  <DateTile start={row.start} />
                  <div className="inbox-body">
                    <div className="inbox-top">
                      <h3>{row.name}</h3>
                      <span className="inbox-badges">
                        {over && row.status !== 'declined' ? (
                          <span className="inbox-moment is-over">Geweest</span>
                        ) : moment === 'now' && row.status === 'confirmed' ? (
                          <span className="inbox-moment is-now">Nu bezig</span>
                        ) : today && row.status !== 'declined' ? (
                          <span className="inbox-moment is-today">Vandaag</span>
                        ) : null}
                        <span className="inbox-status">{expired ? 'Verlopen' : STATUS_LABEL[row.status]}</span>
                      </span>
                    </div>
                    <p className="inbox-tags">
                      <span className="inbox-tag is-service">
                        {serviceName(row.service)} · {row.minutes} min
                      </span>
                      {row.status === 'noshow' ? (
                        <span className="inbox-tag is-unpaid">niet betaald</span>
                      ) : (() => {
                        const money = bookingMoney(row, prices)
                        const changed = row.charged !== null || (row.items ?? []).length > 0
                        return (
                          <>
                            <span className={`inbox-tag${changed ? ' is-money' : ''}`}>{formatMoney(money.total)}</span>
                            {money.discount > 0 ? <span className="inbox-tag is-discount">korting {formatMoney(money.discount)}</span> : null}
                            {money.pieces > 0 ? (
                              <span className="inbox-tag">
                                {money.pieces} product{money.pieces === 1 ? '' : 'en'}
                              </span>
                            ) : null}
                          </>
                        )
                      })()}
                      {row.status === 'confirmed' && row.paid === true ? <span className="inbox-tag is-paid">Betaald</span> : null}
                      {row.status === 'confirmed' && row.paid === false && over ? (
                        <span className="inbox-tag is-unpaid">Nog niet betaald</span>
                      ) : null}
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
                    {!isMoving ? (
                      <div className="inbox-actions">
                        {row.status === 'confirmed' && over ? (
                          <button
                            type="button"
                            className="inbox-noshow"
                            aria-label={`${row.name} niet gekomen`}
                            disabled={decidingId === row.id}
                            onClick={() => {
                              void decide(row.id, 'noshow')
                            }}
                          >
                            Niet gekomen
                          </button>
                        ) : null}
                        {row.status === 'noshow' ? (
                          <button
                            type="button"
                            className="inbox-showed"
                            aria-label={`${row.name} toch gekomen`}
                            disabled={decidingId === row.id}
                            onClick={() => {
                              void decide(row.id, 'showed')
                            }}
                          >
                            Toch gekomen
                          </button>
                        ) : null}
                        {row.status === 'confirmed' && row.paid === false ? (
                          <button
                            type="button"
                            className="inbox-pay"
                            aria-label={`${row.name} betaald`}
                            disabled={payingId === row.id}
                            onClick={() => {
                              void markPaid(row)
                            }}
                          >
                            {payingId === row.id ? 'Bezig…' : 'Betaald'}
                          </button>
                        ) : null}
                        {row.status === 'confirmed' ? (
                          <button
                            type="button"
                            className="inbox-order-open"
                            aria-label={`Bon ${row.name}`}
                            onClick={() => {
                              setMoving(null)
                              setNotice(null)
                              setDone(null)
                              setOrderId(row.id)
                            }}
                          >
                            Bon
                          </button>
                        ) : null}
                        {unsent ? <span className="inbox-warn">Mail niet gegaan</span> : null}
                        {row.status === 'pending' ? (
                          <>
                            {/* A request whose time has passed can only be declined. */}
                            {expired ? null : (
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
                            )}
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
                        <button
                          type="button"
                          className="inbox-edit"
                          aria-label={`${row.name} wijzigen`}
                          onClick={() => {
                            setMoving(null)
                            setDone(null)
                            setEditId(row.id)
                          }}
                        >
                          Wijzigen
                        </button>
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
