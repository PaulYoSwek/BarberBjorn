import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  DAY_PARTS,
  dayLabel,
  EMPTY_FILTER,
  filterActive,
  filterClients,
  formatEuro,
  summarizeClients,
  WEEK_ORDER,
  type ClientFilter,
  type ClientRecord,
  type ClientSort,
  type ClientSummary,
  type DayPart,
  type Recency,
} from '../../clients'
import { copy, type ServiceId } from '../../content'
import { deleteClient, loadClients, loadServices, saveClient, type InboxRow } from '../../planning-api'
import type { Weekday } from '../../schedule'

type Props = { rows: InboxRow[]; onDeleted?: () => void }

type Draft = { id?: string; key?: string; name: string; email: string; phone: string; note: string }

const EMPTY_DRAFT: Draft = { name: '', email: '', phone: '', note: '' }

const SORTS: { value: ClientSort; label: string }[] = [
  { value: 'visits', label: 'Meeste bezoeken' },
  { value: 'paid', label: 'Meest betaald' },
  { value: 'last', label: 'Laatst geweest' },
  { value: 'new', label: 'Nieuwste klant' },
  { value: 'name', label: 'Naam A–Z' },
]

const RECENCY: { value: Recency; label: string }[] = [
  { value: '', label: 'Altijd' },
  { value: 'month', label: 'Afgelopen maand' },
  { value: 'quarter', label: '1 tot 3 maanden geleden' },
  { value: 'away', label: 'Langer dan 3 maanden' },
  { value: 'never', label: 'Nog nooit geweest' },
]

const SAVE_ERRORS: Record<string, string> = {
  exists: 'Er is al een klant met dit mailadres.',
  name: 'Vul een naam in van minstens twee letters.',
  email: 'Dit mailadres klopt niet.',
}

function dateLabel(start: string | null): string {
  if (!start) return '—'
  const date = start.slice(0, 10)
  const weekday = WEEK_ORDER[(new Date(`${date}T12:00:00`).getDay() + 6) % 7]
  const month = copy.nl.monthShort[Number(date.slice(5, 7)) - 1]
  const time = start.length > 10 ? ` · ${start.slice(11, 16)}` : ''
  return `${dayLabel(weekday)} ${Number(date.slice(8, 10))} ${month} ${date.slice(0, 4)}${time}`
}

function usually(summary: ClientSummary): string {
  if (!summary.favoriteDay) return '—'
  const parts = [dayLabel(summary.favoriteDay), summary.favoritePart]
  if (summary.favoriteTime) parts.push(`rond ${summary.favoriteTime}`)
  return parts.filter(Boolean).join(' · ')
}

export function AdminClients({ rows, onDeleted }: Props) {
  const [stored, setStored] = useState<ClientRecord[]>([])
  const [ready, setReady] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [prices, setPrices] = useState<Partial<Record<ServiceId, string>>>({})
  const [filter, setFilter] = useState<ClientFilter>(EMPTY_FILTER)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  function refresh() {
    return loadClients()
      .then((list) => {
        setStored(list.clients)
        setReady(list.ready)
      })
      .catch(() => setNotice('Klanten laden mislukt. Je ziet alleen klanten uit de afspraken.'))
      .finally(() => setLoaded(true))
  }

  useEffect(() => {
    void refresh()
    loadServices()
      .then((services) => {
        const next: Partial<Record<ServiceId, string>> = {}
        for (const service of services) next[service.id] = service.price
        setPrices(next)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!done) return
    const timer = window.setTimeout(() => setDone(null), 6000)
    return () => window.clearTimeout(timer)
  }, [done])

  const fallbackPrices = useMemo(() => {
    const seed: Partial<Record<ServiceId, string>> = {}
    for (const item of copy.nl.services) seed[item.id] = item.price
    return { ...seed, ...prices }
  }, [prices])

  const all = useMemo(() => summarizeClients(stored, rows, fallbackPrices), [stored, rows, fallbackPrices])
  const shown = useMemo(() => filterClients(all, filter), [all, filter])
  const totals = useMemo(
    () => ({
      visits: shown.reduce((sum, item) => sum + item.visits, 0),
      paid: shown.reduce((sum, item) => sum + item.paid, 0),
    }),
    [shown],
  )

  function patch(next: Partial<ClientFilter>) {
    setFilter((current) => ({ ...current, ...next }))
  }

  function edit(summary: ClientSummary) {
    setNotice(null)
    setDone(null)
    setConfirming(false)
    setDraft({
      id: summary.id ?? undefined,
      key: summary.key,
      name: summary.name,
      email: summary.email,
      phone: summary.phone,
      note: summary.note,
    })
  }

  async function remove() {
    if (!draft || busy) return
    setBusy(true)
    try {
      const result = await deleteClient({ id: draft.id, email: draft.email, phone: draft.phone })
      if (!result.ok) {
        setNotice('Verwijderen mislukt. Probeer het nog eens.')
        return
      }
      setNotice(null)
      setDone(`${draft.name.trim() || 'De klant'} en alle afspraken zijn verwijderd.`)
      setDraft(null)
      setConfirming(false)
      await refresh()
      onDeleted?.()
    } finally {
      setBusy(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft || busy) return
    if (draft.name.trim().length < 2) {
      setNotice(SAVE_ERRORS.name)
      return
    }
    setBusy(true)
    try {
      const { key: _key, ...client } = draft
      const result = await saveClient(client)
      if (!result.ok) {
        setNotice(SAVE_ERRORS[result.error] ?? 'Opslaan mislukt. Probeer het nog eens.')
        return
      }
      setNotice(null)
      setDone(draft.id ? `${draft.name.trim()} is bijgewerkt.` : `${draft.name.trim()} is toegevoegd.`)
      setDraft(null)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-clients">
      <header className="admin-agenda-head">
        <div>
          <p className="admin-kicker">Overzicht</p>
          <h1>Klanten</h1>
        </div>
        {draft ? null : (
          <button
            type="button"
            className="admin-add"
            onClick={() => {
              setNotice(null)
              setDone(null)
              setDraft({ ...EMPTY_DRAFT })
            }}
          >
            + Klant toevoegen
          </button>
        )}
      </header>

      <dl className="admin-stats">
        <div>
          <dt>Klanten</dt>
          <dd>{shown.length}</dd>
        </div>
        <div>
          <dt>Bezoeken</dt>
          <dd>{totals.visits}</dd>
        </div>
        <div>
          <dt>Omzet</dt>
          <dd>{formatEuro(totals.paid)}</dd>
        </div>
      </dl>

      {notice ? <p role="alert">{notice}</p> : null}
      {done ? (
        <p className="admin-done" role="status">
          {done}
        </p>
      ) : null}
      {!ready ? (
        <p className="admin-hint">
          De klantenlijst in de database is nog niet actief. Je ziet nu alleen klanten uit de afspraken.
        </p>
      ) : null}

      {draft ? (
        <form className="admin-client-form" onSubmit={submit} aria-label={draft.id ? 'Klant bewerken' : 'Klant toevoegen'}>
          <p className="admin-hours-title">{draft.id ? 'Klant bewerken' : 'Nieuwe klant'}</p>
          <label>
            Naam
            <input
              value={draft.name}
              autoComplete="off"
              required
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </label>
          <label>
            E-mail
            <input
              type="email"
              value={draft.email}
              autoComplete="off"
              onChange={(event) => setDraft({ ...draft, email: event.target.value })}
            />
          </label>
          <label>
            Telefoon
            <input
              type="tel"
              inputMode="tel"
              value={draft.phone}
              autoComplete="off"
              onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
            />
          </label>
          <label className="is-wide">
            Notitie
            <textarea
              rows={3}
              value={draft.note}
              placeholder="Bijvoorbeeld: kort opzij, lang bovenop"
              onChange={(event) => setDraft({ ...draft, note: event.target.value })}
            />
          </label>
          <div className="admin-actions is-wide">
            <button type="submit" className="admin-primary" disabled={busy}>
              {busy ? 'Opslaan…' : 'Opslaan'}
            </button>
            <button type="button" onClick={() => setDraft(null)}>
              Annuleren
            </button>
          </div>
          {draft.key ? (
            <div className="admin-danger is-wide">
              {confirming ? (
                <>
                  <p>
                    Weet je het zeker? Dit verwijdert {draft.name.trim() || 'deze klant'} en{' '}
                    {(() => {
                      const count = all.find((item) => item.key === draft.key)?.bookings.length ?? 0
                      return count === 1 ? '1 afspraak' : `alle ${count} afspraken`
                    })()}{' '}
                    voorgoed. Dit kan niet ongedaan worden gemaakt.
                  </p>
                  <div className="admin-actions">
                    <button type="button" className="admin-danger-confirm" disabled={busy} onClick={() => void remove()}>
                      {busy ? 'Verwijderen…' : 'Ja, verwijderen'}
                    </button>
                    <button type="button" onClick={() => setConfirming(false)}>
                      Niet verwijderen
                    </button>
                  </div>
                </>
              ) : (
                <button type="button" className="admin-danger-open" onClick={() => setConfirming(true)}>
                  Klant en afspraken verwijderen
                </button>
              )}
            </div>
          ) : null}
        </form>
      ) : null}

      <section className="admin-filters" aria-label="Filters">
        <label className="is-search">
          Zoeken
          <input
            type="search"
            value={filter.query}
            placeholder="Naam, mail of telefoon"
            onChange={(event) => patch({ query: event.target.value })}
          />
        </label>
        <label>
          Bezoeken
          <select value={filter.minVisits} onChange={(event) => patch({ minVisits: Number(event.target.value) })}>
            <option value={0}>Alle</option>
            <option value={1}>1 of meer</option>
            <option value={2}>2 of meer</option>
            <option value={5}>5 of meer</option>
            <option value={10}>10 of meer</option>
          </select>
        </label>
        <label>
          Betaald
          <select value={filter.minPaid} onChange={(event) => patch({ minPaid: Number(event.target.value) })}>
            <option value={0}>Alle</option>
            <option value={50}>€50 of meer</option>
            <option value={100}>€100 of meer</option>
            <option value={250}>€250 of meer</option>
            <option value={500}>€500 of meer</option>
          </select>
        </label>
        <label>
          Vaste dag
          <select value={filter.day} onChange={(event) => patch({ day: event.target.value as Weekday | '' })}>
            <option value="">Alle dagen</option>
            {WEEK_ORDER.map((weekday) => (
              <option key={weekday} value={weekday}>
                {dayLabel(weekday)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Dagdeel
          <select value={filter.part} onChange={(event) => patch({ part: event.target.value as DayPart | '' })}>
            <option value="">Hele dag</option>
            {DAY_PARTS.map((part) => (
              <option key={part} value={part}>
                {part}
              </option>
            ))}
          </select>
        </label>
        <label>
          Laatst geweest
          <select value={filter.recency} onChange={(event) => patch({ recency: event.target.value as Recency })}>
            {RECENCY.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sorteren
          <select value={filter.sort} onChange={(event) => patch({ sort: event.target.value as ClientSort })}>
            {SORTS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        {filterActive(filter) ? (
          <button type="button" className="admin-clear" onClick={() => setFilter({ ...EMPTY_FILTER, sort: filter.sort })}>
            Filters wissen
          </button>
        ) : null}
      </section>

      <p className="admin-inbox-count">
        {shown.length === all.length ? `${all.length} klanten` : `${shown.length} van ${all.length} klanten`}
      </p>

      {!loaded && all.length === 0 ? <p className="admin-hint">Klanten laden…</p> : null}
      {loaded && all.length === 0 ? (
        <p className="admin-hint">Nog geen klanten. Iedereen die een afspraak maakt, komt hier vanzelf bij.</p>
      ) : null}
      {all.length > 0 && shown.length === 0 ? <p className="admin-hint">Geen klanten die bij deze filters passen.</p> : null}

      <ul className="admin-client-list">
        {shown.map((summary) => (
          <li key={summary.key} className="admin-client">
            <div className="admin-client-head">
              <h2>{summary.name || 'Zonder naam'}</h2>
              <p className="admin-client-score">
                <strong>{summary.visits}×</strong>
                <span>{formatEuro(summary.paid)}</span>
              </p>
            </div>
            <p className="admin-client-contact">
              {summary.email ? <a href={`mailto:${summary.email}`}>{summary.email}</a> : null}
              {summary.phone ? <a href={`tel:${summary.phone.replace(/\s+/g, '')}`}>{summary.phone}</a> : null}
            </p>
            <dl className="admin-inbox-meta">
              <div>
                <dt>Komt meestal</dt>
                <dd>{usually(summary)}</dd>
              </div>
              <div>
                <dt>Laatst geweest</dt>
                <dd>{dateLabel(summary.lastVisit)}</dd>
              </div>
              <div>
                <dt>Volgende afspraak</dt>
                <dd>{dateLabel(summary.nextVisit)}</dd>
              </div>
              <div>
                <dt>Klant sinds</dt>
                <dd>{dateLabel(summary.since)}</dd>
              </div>
            </dl>
            {summary.note ? <p className="admin-client-note">{summary.note}</p> : null}
            <div className="admin-actions">
              <button type="button" aria-label={`${summary.name} bewerken`} onClick={() => edit(summary)}>
                Bewerken
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
