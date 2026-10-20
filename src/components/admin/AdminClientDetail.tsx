import { useEffect } from 'react'
import { dayLabel, formatEuro, WEEK_ORDER, type ClientSummary } from '../../clients'
import { copy, type ServiceId } from '../../content'
import { bookingMoney, formatMoney } from '../../finance'
import type { InboxRow } from '../../planning-api'
import { serviceName } from './admin-defaults'
import { momentOf } from './AdminInbox'
import { hueOf, initials } from './client-chip'

type Props = {
  summary: ClientSummary
  /** Every appointment the dashboard knows; the client's own are picked out by id. */
  rows: InboxRow[]
  prices: Partial<Record<ServiceId, string>>
  onClose: () => void
  onEdit: () => void
}

function dateOf(start: string): string {
  const date = start.slice(0, 10)
  const weekday = WEEK_ORDER[(new Date(`${date}T12:00:00`).getDay() + 6) % 7]
  return `${dayLabel(weekday)} ${Number(date.slice(8, 10))} ${copy.nl.monthShort[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`
}

function longDate(start: string | null): string {
  return start ? `${dateOf(start)}${start.length > 10 ? ` · ${start.slice(11, 16)}` : ''}` : '—'
}

function usually(summary: ClientSummary): string {
  if (!summary.favoriteDay) return '—'
  const parts = [dayLabel(summary.favoriteDay), summary.favoritePart]
  if (summary.favoriteTime) parts.push(`rond ${summary.favoriteTime}`)
  return parts.filter(Boolean).join(' · ')
}

type Standing = { key: 'over' | 'coming' | 'pending' | 'expired' | 'declined' | 'noshow'; label: string }

function standingOf(row: InboxRow, now: Date): Standing {
  if (row.status === 'declined') return { key: 'declined', label: 'Geweigerd' }
  if (row.status === 'noshow') return { key: 'noshow', label: 'Niet gekomen' }
  const over = momentOf(row, now) === 'over'
  if (row.status === 'pending') return over ? { key: 'expired', label: 'Verlopen' } : { key: 'pending', label: 'Te beoordelen' }
  return over ? { key: 'over', label: 'Geweest' } : { key: 'coming', label: 'Komend' }
}

/** Everything about one client: how often, what they paid, every appointment. */
export function AdminClientDetail({ summary, rows, prices, onClose, onEdit }: Props) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const now = new Date()
  const own = new Set(summary.bookings.map((booking) => booking.id))
  const bookings = rows.filter((row) => own.has(row.id)).sort((a, b) => b.start.localeCompare(a.start))
  const visits = bookings.filter((row) => row.status === 'confirmed' && standingOf(row, now).key === 'over')
  const money = visits.map((row) => bookingMoney(row, prices))
  const totals = money.reduce(
    (sum, item) => ({
      services: sum.services + item.servicePrice,
      products: sum.products + item.productsTotal,
      discount: sum.discount + item.discount,
      total: sum.total + item.total,
    }),
    { services: 0, products: 0, discount: 0, total: 0 },
  )
  const average = visits.length > 0 ? totals.total / visits.length : 0
  const name = summary.name || 'Zonder naam'

  return (
    <div className="admin-modal" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <section className="admin-detail" role="dialog" aria-modal="true" aria-label={`Overzicht ${name}`}>
        <header className="admin-detail-head">
          <span className={`admin-client-chip is-hue-${hueOf(summary.name)}`} aria-hidden="true">
            {initials(summary.name)}
          </span>
          <div className="admin-detail-who">
            <p className="admin-kicker">Klant</p>
            <h2>{name}</h2>
            <p className="admin-client-contact">
              {summary.email ? <a href={`mailto:${summary.email}`}>{summary.email}</a> : null}
              {summary.phone ? <a href={`tel:${summary.phone.replace(/\s+/g, '')}`}>{summary.phone}</a> : null}
            </p>
          </div>
          <button type="button" className="admin-detail-close" aria-label="Sluiten" onClick={onClose}>
            ×
          </button>
        </header>

        <dl className="admin-stats admin-detail-stats">
          <div>
            <dt>Bezoeken</dt>
            <dd>{visits.length}</dd>
          </div>
          <div>
            <dt>Besteed</dt>
            <dd>{formatEuro(totals.total)}</dd>
          </div>
          <div>
            <dt>Per bezoek</dt>
            <dd>{formatEuro(average)}</dd>
          </div>
          <div>
            <dt>Komend</dt>
            <dd>{summary.upcoming}</dd>
          </div>
          <div className={summary.noShows > 0 ? 'is-warn' : undefined}>
            <dt>Niet gekomen</dt>
            <dd>{summary.noShows}</dd>
          </div>
        </dl>

        <dl className="admin-inbox-meta admin-detail-facts">
          <div>
            <dt>Komt meestal</dt>
            <dd>{usually(summary)}</dd>
          </div>
          <div>
            <dt>Laatst geweest</dt>
            <dd>{longDate(summary.lastVisit)}</dd>
          </div>
          <div>
            <dt>Volgende afspraak</dt>
            <dd>{longDate(summary.nextVisit)}</dd>
          </div>
          <div>
            <dt>Klant sinds</dt>
            <dd>{longDate(summary.since)}</dd>
          </div>
        </dl>

        {summary.note ? <p className="admin-client-note">{summary.note}</p> : null}

        <h3 className="admin-detail-title">
          Afspraken <span>{bookings.length}</span>
        </h3>
        {bookings.length === 0 ? (
          <p className="admin-hint">Nog geen afspraken.</p>
        ) : (
          <ul className="admin-detail-list">
            {bookings.map((row) => {
              const standing = standingOf(row, now)
              const amount = bookingMoney(row, prices)
              const counted = row.status === 'confirmed' && standing.key === 'over'
              return (
                <li key={row.id} className={`admin-detail-row is-${standing.key}`}>
                  <div className="admin-detail-when">
                    <strong>{dateOf(row.start)}</strong>
                    <span>{row.start.slice(11, 16)}</span>
                  </div>
                  <div className="admin-detail-what">
                    <strong>{serviceName(row.service)}</strong>
                    <span>
                      {row.minutes} min{row.kind === 'custom' ? ' · ander tijdstip' : ''}
                      {amount.discount > 0 ? ` · korting ${formatMoney(amount.discount)}` : ''}
                    </span>
                    {(row.items ?? []).length > 0 ? (
                      <span className="admin-detail-items">
                        {(row.items ?? []).map((item) => `${item.quantity}× ${item.name}`).join(', ')}
                      </span>
                    ) : null}
                  </div>
                  <span className={`admin-detail-standing is-${standing.key}`}>{standing.label}</span>
                  <strong className={`admin-detail-amount${counted ? '' : ' is-muted'}`}>{formatMoney(amount.total)}</strong>
                </li>
              )
            })}
          </ul>
        )}

        {visits.length > 0 ? (
          <dl className="admin-detail-totals">
            <div>
              <dt>Diensten</dt>
              <dd>{formatMoney(totals.services)}</dd>
            </div>
            <div>
              <dt>Producten</dt>
              <dd>{formatMoney(totals.products)}</dd>
            </div>
            <div>
              <dt>Korting</dt>
              <dd>{formatMoney(totals.discount)}</dd>
            </div>
            <div className="is-total">
              <dt>Totaal</dt>
              <dd>{formatMoney(totals.total)}</dd>
            </div>
          </dl>
        ) : null}

        <div className="admin-detail-actions">
          <button type="button" className="is-primary" onClick={onEdit}>
            Bewerken
          </button>
          <button type="button" onClick={onClose}>
            Sluiten
          </button>
        </div>
      </section>
    </div>
  )
}
