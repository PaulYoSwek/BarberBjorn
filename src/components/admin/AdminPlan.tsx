import { useEffect, useRef, useState, type FormEvent } from 'react'
import { euroLabel } from '../../clients'
import type { ServiceId } from '../../content'
import { adminBook, loadClients, type InboxRow } from '../../planning-api'
import { SLOT_MINUTES } from '../../schedule'
import { offered, serviceCatalog } from '../../service-catalog'
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const LENGTH_STEP = 5
const LENGTH_MAX = 120

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

type Person = { name: string; email: string; phone: string }

function keyOf(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Everyone Bjorn has cut or written down, one per name: the bookings first
 * (newest wins, so the latest mail and phone are used), then the clients he
 * keeps on the Klanten tab who never booked through the site.
 */
export function knownPeople(people: InboxRow[], stored: Person[] = []): Person[] {
  const seen = new Map<string, Person>()
  for (const row of [...people].sort((a, b) => b.start.localeCompare(a.start))) {
    const key = keyOf(row.name)
    if (!key) continue
    const found = seen.get(key)
    if (!found) seen.set(key, { name: row.name.trim(), email: row.email.trim(), phone: row.phone.trim() })
    else {
      if (!found.email && row.email.trim()) found.email = row.email.trim()
      if (!found.phone && row.phone.trim()) found.phone = row.phone.trim()
    }
  }
  for (const person of stored) {
    const key = keyOf(person.name)
    if (!key) continue
    const found = seen.get(key)
    if (!found) seen.set(key, { name: person.name.trim(), email: person.email.trim(), phone: person.phone.trim() })
    else {
      if (!found.email && person.email.trim()) found.email = person.email.trim()
      if (!found.phone && person.phone.trim()) found.phone = person.phone.trim()
    }
  }
  return [...seen.values()]
}

/** The people whose name, mail or phone contains what Bjorn typed so far; first names first. */
export function suggestPeople(known: Person[], typed: string, limit = 6): Person[] {
  const query = keyOf(typed)
  if (!query) return []
  const digits = query.replace(/\D/g, '')
  const scored = known
    .map((person) => {
      const name = keyOf(person.name)
      let score = 0
      if (name === query) score = 4
      else if (name.startsWith(query)) score = 3
      else if (name.split(' ').some((part) => part.startsWith(query))) score = 2
      else if (name.includes(query) || person.email.toLowerCase().includes(query)) score = 1
      else if (digits.length >= 3 && person.phone.replace(/\D/g, '').includes(digits)) score = 1
      return { person, score }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.person.name.localeCompare(b.person.name))
  return scored.slice(0, limit).map((item) => item.person)
}

export function AdminPlan({ date, time, stamp, people, check, onClose, onBooked }: Props) {
  const services = offered(serviceCatalog())
  const [service, setService] = useState<ServiceId>(services[0]?.id ?? 'cut')
  const [start, setStart] = useState(time)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [mail, setMail] = useState(true)
  /** Chosen length; null follows the service. */
  const [override, setOverride] = useState<number | null>(null)
  const [paidChoice, setPaidChoice] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const first = useRef<HTMLSelectElement>(null)
  const [stored, setStored] = useState<Person[]>([])
  const [picking, setPicking] = useState(false)
  const known = knownPeople(people, stored)
  // The picker lists everyone by name; a tap on one fills the form, like the suggestions do.
  const roster = [...known].sort((a, b) => a.name.localeCompare(b.name, 'nl'))
  const pickedKey = roster.find((person) => keyOf(person.name) === keyOf(name)) ? keyOf(name) : ''
  const suggestions = picking ? suggestPeople(known, name) : []

  // Clients kept on the Klanten tab, so someone added by hand is found too. Offline: just the bookings.
  useEffect(() => {
    let cancelled = false
    loadClients()
      .then((list) => {
        if (!cancelled) setStored(list.clients)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    first.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const chosen = services.find((item) => item.id === service) ?? services[0]
  const standard = chosen?.minutes ?? 30
  const length = override ?? standard
  const under = check(date, start, length)
  // A walk-in is often written down afterwards; it counts as been, and gets no mail.
  const over = `${date}T${start}:00` <= wallNow()
  // Payment is tracked once the bookings carry it; a past walk-in is usually paid already.
  const tracksPayment = people.some((row) => row.paid !== undefined)
  const paid = paidChoice ?? over
  // Five-minute steps up to two hours; a longer service keeps its own length in the list.
  const lengths: number[] = []
  for (let total = LENGTH_STEP; total <= LENGTH_MAX; total += LENGTH_STEP) lengths.push(total)
  if (!lengths.includes(standard)) lengths.push(standard)
  lengths.sort((a, b) => a - b)
  const emailOk = !email.trim() || EMAIL.test(email.trim())

  function pickName(value: string) {
    setName(value)
    setPicking(true)
    const match = known.find((person) => keyOf(person.name) === keyOf(value))
    if (!match) return
    if (!email.trim() && match.email) setEmail(match.email)
    if (!phone.trim() && match.phone) setPhone(match.phone)
  }

  /** A tap on a suggestion fills everything in; the typed text is replaced by the name on record. */
  function choose(person: Person) {
    setName(person.name)
    if (person.email) setEmail(person.email)
    if (person.phone) setPhone(person.phone)
    setPicking(false)
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
      ...(length !== standard ? { minutes: length } : {}),
      ...(tracksPayment && paid ? { paid: true } : {}),
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
      ...(tracksPayment ? { paid } : {}),
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
          <select
            ref={first}
            value={service}
            onChange={(event) => {
              setService(event.target.value as ServiceId)
              setOverride(null)
            }}
          >
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
          Duur
          <select
            aria-label="Duur"
            value={length}
            onChange={(event) => {
              const next = Number(event.target.value)
              setOverride(next === standard ? null : next)
            }}
          >
            {lengths.map((total) => (
              <option key={total} value={total}>
                {total} min · tot {endOf(start, total)}
                {total === standard ? ' (standaard)' : ''}
              </option>
            ))}
          </select>
        </label>
        {roster.length > 0 ? (
          <label>
            Bekende klant
            <select
              aria-label="Bekende klant"
              value={pickedKey}
              onChange={(event) => {
                const person = roster.find((item) => keyOf(item.name) === event.target.value)
                if (person) choose(person)
              }}
            >
              <option value="">Kies een klant, of typ een nieuwe naam</option>
              {roster.map((person) => (
                <option key={person.name} value={keyOf(person.name)}>
                  {person.name}
                  {person.phone ? ` · ${person.phone}` : ''}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="admin-plan-name">
          <label>
            Naam
            <input
              value={name}
              maxLength={80}
              autoComplete="off"
              autoCapitalize="words"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={suggestions.length > 0}
              aria-controls="admin-plan-people"
              onChange={(event) => pickName(event.target.value)}
              onFocus={() => setPicking(true)}
              onBlur={() => setPicking(false)}
              required
            />
          </label>
          {suggestions.length > 0 ? (
            <ul className="admin-plan-suggest" id="admin-plan-people" role="listbox" aria-label="Bekende klanten">
              {suggestions.map((person) => (
                <li key={person.name} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={keyOf(person.name) === keyOf(name)}
                    // Mouse-down would blur the input and close the list before the click lands.
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(person)}
                  >
                    <strong>{person.name}</strong>
                    <span>{[person.phone, person.email].filter(Boolean).join(' · ') || 'geen gegevens'}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
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
        {tracksPayment ? (
          <label className="admin-plan-check">
            <input type="checkbox" checked={paid} onChange={(event) => setPaidChoice(event.target.checked)} />
            Al betaald
          </label>
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
