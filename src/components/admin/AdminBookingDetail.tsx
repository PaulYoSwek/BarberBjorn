import { useEffect, useState } from 'react'
import { euroLabel } from '../../clients'
import type { ServiceId } from '../../content'
import { adminWrite, type InboxRow } from '../../planning-api'
import { offered, serviceCatalog } from '../../service-catalog'
import { serviceName } from './admin-defaults'

type Props = {
  row: InboxRow
  /** "ma 5 okt" style label of the day. */
  stamp: string
  onClose: () => void
  onChanged: (row: InboxRow) => void
  onDeleted: (row: InboxRow) => void
}

const STATUS_LABEL: Record<InboxRow['status'], string> = {
  pending: 'In afwachting',
  confirmed: 'Bevestigd',
  noshow: 'Niet gekomen',
  declined: 'Geweigerd',
}

function clockAfter(time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(Number)
  const total = hours * 60 + mins + minutes
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function errorText(error: string): string {
  if (error === 'overlap') return 'Met deze dienst loopt de afspraak over een andere afspraak heen. Kies een kortere dienst of verplaats eerst.'
  if (error === 'missing') return 'Deze afspraak bestaat niet meer. Ververs de pagina.'
  if (error === 'service') return 'Deze dienst wordt niet meer aangeboden.'
  if (error === 'offline') return 'Geen verbinding. Probeer het nog eens.'
  return 'Opslaan mislukt. Probeer het nog eens.'
}

/** A booked appointment: who and when, change the service, or remove it. */
export function AdminBookingDetail({ row, stamp, onClose, onChanged, onDeleted }: Props) {
  const catalog = serviceCatalog()
  const choices = offered(catalog)
  // A service Bjorn has since hidden still shows for the appointment that has it.
  const current = catalog.find((item) => item.id === row.service)
  const options = current && !choices.some((item) => item.id === current.id) ? [current, ...choices] : choices
  const [service, setService] = useState<ServiceId>(row.service)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const time = row.start.slice(11, 16)
  const chosen = options.find((item) => item.id === service)
  const length = service === row.service ? row.minutes : (chosen?.minutes ?? row.minutes)
  const changed = service !== row.service

  async function saveService() {
    if (busy || !changed || !chosen) return
    setBusy(true)
    setError(null)
    const result = await adminWrite({ type: 'bookingService', id: row.id, service })
    setBusy(false)
    if (!result.ok) return setError(errorText(result.error))
    onChanged({ ...row, service, minutes: chosen.minutes, price: chosen.price, charged: null })
  }

  async function remove() {
    if (busy) return
    setBusy(true)
    setError(null)
    const result = await adminWrite({ type: 'bookingDelete', id: row.id })
    setBusy(false)
    if (!result.ok) {
      setConfirming(false)
      return setError(errorText(result.error))
    }
    onDeleted(row)
  }

  return (
    <div className="admin-modal" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <section className="admin-plan admin-booking-edit" role="dialog" aria-modal="true" aria-label="Boeking">
        <p className="admin-kicker">Afspraak · {STATUS_LABEL[row.status]}</p>
        <h2>{row.name}</h2>
        <p className="admin-booking-when">
          {stamp} · {time}–{clockAfter(time, length)}
        </p>
        <p className="admin-booking-what">
          {serviceName(row.service)} · {row.minutes} min
          {row.kind === 'custom' ? ' · ander tijdstip' : ''}
          {row.mail_sent ? '' : ' · mail niet gegaan'}
        </p>
        <p className="admin-booking-contact">
          {row.email ? <a href={`mailto:${row.email}`}>{row.email}</a> : null}
          {row.phone ? <a href={`tel:${row.phone.replace(/\s+/g, '')}`}>{row.phone}</a> : null}
        </p>

        <label>
          Dienst
          <select
            aria-label="Dienst"
            value={service}
            disabled={busy}
            onChange={(event) => {
              setService(event.target.value)
              setError(null)
            }}
          >
            {options.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name.nl} · {item.minutes} min · {euroLabel(item.price)}
              </option>
            ))}
          </select>
        </label>
        {changed && chosen ? (
          <p className="admin-plan-warn">
            Wordt {time}–{clockAfter(time, chosen.minutes)}. De prijs wordt {euroLabel(chosen.price)}; een eerder
            ingevoerde korting vervalt. De klant krijgt geen mail.
          </p>
        ) : null}
        {error ? <p role="alert">{error}</p> : null}

        <div className="admin-plan-actions">
          <button type="button" className="admin-plan-go" disabled={!changed || busy} onClick={() => void saveService()}>
            {busy && changed ? 'Opslaan…' : 'Dienst opslaan'}
          </button>
          <button type="button" onClick={onClose}>
            Sluiten
          </button>
        </div>

        <div className="admin-booking-danger">
          {confirming ? (
            <>
              <p>
                {row.name} op {stamp} om {time} verwijderen? Dit kan niet ongedaan worden en de klant krijgt geen mail.
              </p>
              <div className="admin-plan-actions">
                <button type="button" className="is-danger" disabled={busy} onClick={() => void remove()}>
                  {busy ? 'Verwijderen…' : 'Echt verwijderen'}
                </button>
                <button type="button" disabled={busy} onClick={() => setConfirming(false)}>
                  Annuleren
                </button>
              </div>
            </>
          ) : (
            <button type="button" className="admin-booking-delete" onClick={() => setConfirming(true)}>
              Afspraak verwijderen
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
