import { useEffect, useRef, useState, type FormEvent } from 'react'
import { euroLabel } from '../../clients'
import type { ServiceId } from '../../content'
import { adminBook, type InboxRow } from '../../planning-api'
import { SLOT_MINUTES } from '../../schedule'
import { offered, serviceCatalog } from '../../service-catalog'
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** What lies under an appointment from a start time on, as the agenda shows it. */
export type PlanCheck = { booked: boolean; shut: boolean; late: boolean }

type Props = {
  date: string
  time: string
  /** Long weekday label, e.g. "di 13 okt". */
  stamp: string
  people: InboxRow[]
  check: (date: string, time: string, minutes: number) => PlanCheck
  onClose: () => void
  onBooked: (row: InboxRow) => void
}

function clock(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** The salon clock as the agenda writes it: yyyy-mm-ddThh:mm:00. */
function wallNow(): string {
  const now = new Date()
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:00`
}

function endOf(time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(Number)
  return clock(hours * 60 + mins + minutes)
}

function errorText(error: string): string {
  if (error === 'overlap') return 'Op dit tijdstip staat al een afspraak. Kies een andere tijd.'
  if (error === 'past') return 'Dit tijdstip is al voorbij.'
  if (error === 'email') return 'Dit e-mailadres klopt niet.'
  if (error === 'offline') return 'Geen verbinding. Probeer het nog eens.'
  return 'Inplannen mislukt. Probeer het nog eens.'
}

/** Known clients, newest booking first, one per name. */
function knownPeople(people: InboxRow[]): InboxRow[] {
  const seen = new Set<string>()
  const list: InboxRow[] = []
  for (const row of [...people].sort((a, b) => b.start.localeCompare(a.start))) {
    const key = row.name.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    list.push(row)
  }
  return list
}

export function AdminPlan({ date, time, stamp, people, check, onClose, onBooked }: Props) {
  const services = offered(serviceCatalog())
  const [service, setService] = useState<ServiceId>(services[0]?.id ?? 'cut')
  const [start, setStart] = useState(time)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [mail, setMail] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const first = useRef<HTMLSelectElement>(null)
  const known = knownPeople(people)

  useEffect(() => {
    first.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const chosen = services.find((item) => item.id === service) ?? services[0]
  const length = chosen?.minutes ?? 30
  const under = check(date, start, length)
  // A walk-in is often written down afterwards; it counts as been, and gets no mail.
  const over = `${date}T${start}:00` <= wallNow()
  const emailOk = !email.trim() || EMAIL.test(email.trim())

  function pickName(value: string) {
    setName(value)
    const match = known.find((row) => row.name.trim().toLowerCase() === value.trim().toLowerCase())
    if (!match) return
    if (!email.trim() && match.email) setEmail(match.email)
    if (!phone.trim() && match.phone) setPhone(match.phone)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (!name.trim()) return setError('Vul een naam in.')
    if (!emailOk) return setError(errorText('email'))
    if (under.booked) return setError(errorText('overlap'))
    setBusy(true)
    setError(null)
    const wall = `${date}T${start}:00`
    const send = mail && !over && email.trim() !== ''
    const result = await adminBook({
      service,
      start: wall,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      mail: send,
    })
    setBusy(false)
    if (!result.ok) return setError(errorText(result.error))
    onBooked({
      id: `new-${wall}`,
      service,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      start: wall,
      minutes: length,
      kind: 'slot',
      status: 'confirmed',
      lang: 'nl',
      mail_sent: result.sent,
      price: chosen?.price ?? null,
      charged: null,
      items: [],
    })
  }

  const steps: string[] = []
  for (let total = 0; total < 24 * 60; total += SLOT_MINUTES) steps.push(clock(total))

  return (
    <div className="admin-modal" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <form className="admin-plan" role="dialog" aria-modal="true" aria-label="Afspraak plannen" onSubmit={submit}>
        <p className="admin-kicker">Afspraak plannen</p>
        <h2>
          {stamp} · {start}–{endOf(start, length)}
        </h2>
        <label>
          Dienst
          <select ref={first} value={service} onChange={(event) => setService(event.target.value as ServiceId)}>
            {services.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name.nl} · {item.minutes} min · {euroLabel(item.price)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Begintijd
          <select value={start} onChange={(event) => setStart(event.target.value)}>
            {steps.map((step) => (
              <option key={step} value={step}>
                {step}
              </option>
            ))}
          </select>
        </label>
        <label>
          Naam
          <input
            value={name}
            maxLength={80}
            autoComplete="off"
            list="admin-plan-people"
            onChange={(event) => pickName(event.target.value)}
            required
          />
          <datalist id="admin-plan-people">
            {known.map((row) => (
              <option key={row.id} value={row.name} />
            ))}
          </datalist>
        </label>
        <label>
          Telefoon (mag leeg)
          <input type="tel" value={phone} maxLength={40} onChange={(event) => setPhone(event.target.value)} />
        </label>
        <label>
          E-mail (mag leeg)
          <input
            type="email"
            value={email}
            maxLength={160}
            aria-invalid={!emailOk}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        {over ? (
          <p className="admin-plan-warn">Dit tijdstip is al geweest. De afspraak telt meteen als geweest; er gaat geen mail.</p>
        ) : null}
        {email.trim() && !over ? (
          <label className="admin-plan-check">
            <input type="checkbox" checked={mail} onChange={(event) => setMail(event.target.checked)} />
            Stuur een bevestiging per mail
          </label>
        ) : null}
        {under.booked ? (
          <p className="admin-plan-warn is-stop">Deze tijd loopt over een andere afspraak heen.</p>
        ) : under.shut || under.late ? (
          <p className="admin-plan-warn">
            {under.late ? 'Loopt door na sluitingstijd.' : 'Loopt over een dichte tijd.'} Je kunt hem toch inplannen.
          </p>
        ) : null}
        {error ? <p role="alert">{error}</p> : null}
        <div className="admin-plan-actions">
          <button type="submit" className="admin-plan-go" disabled={busy || under.booked}>
            {busy ? 'Inplannen…' : 'Inplannen'}
          </button>
          <button type="button" onClick={onClose}>
            Annuleren
          </button>
        </div>
      </form>
    </div>
  )
}
