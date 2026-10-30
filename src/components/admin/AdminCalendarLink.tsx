import { useState } from 'react'
import { subscribeLinks } from '../../calendar-feed'
import { loadCalendarLink } from '../../planning-api'

type State =
  | { kind: 'closed' }
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'open'; url: string; name: string; copied: boolean }

/** The booked appointments in Bjorn's own Google Calendar, Outlook or iPhone, as a subscription. */
export function AdminCalendarLink() {
  const [state, setState] = useState<State>({ kind: 'closed' })

  async function open() {
    setState({ kind: 'loading' })
    try {
      const link = await loadCalendarLink()
      setState({ kind: 'open', ...link, copied: false })
    } catch {
      setState({ kind: 'failed' })
    }
  }

  async function copy(url: string, name: string) {
    try {
      await navigator.clipboard.writeText(url)
      setState({ kind: 'open', url, name, copied: true })
    } catch {
      /* the field stays selectable */
    }
  }

  return (
    <section className="admin-calendar-link" aria-label="Agenda koppelen">
      <p className="admin-hours-title">Agenda koppelen</p>
      {state.kind !== 'open' ? (
        <>
          <p className="admin-hint">Zie de afspraken ook in je eigen Google Agenda, Outlook of iPhone-agenda.</p>
          <button type="button" className="admin-calendar-open" disabled={state.kind === 'loading'} onClick={() => void open()}>
            {state.kind === 'loading' ? 'Laden…' : 'Koppelen aan Google of Outlook'}
          </button>
          {state.kind === 'failed' ? <p role="alert">Link ophalen mislukt. Probeer het nog eens.</p> : null}
        </>
      ) : (
        (() => {
          const links = subscribeLinks(state.url, state.name)
          return (
            <>
              <div className="admin-calendar-apps">
                <a href={links.google} target="_blank" rel="noreferrer">
                  Google Agenda
                </a>
                <a href={links.outlook} target="_blank" rel="noreferrer">
                  Outlook
                </a>
                <a href={links.apple}>iPhone / Mac</a>
              </div>
              <label className="admin-calendar-url">
                <span>Of plak deze link bij "agenda toevoegen via URL"</span>
                <input readOnly value={state.url} onFocus={(event) => event.currentTarget.select()} />
              </label>
              <button type="button" className="admin-calendar-copy" onClick={() => void copy(state.url, state.name)}>
                {state.copied ? 'Gekopieerd' : 'Link kopiëren'}
              </button>
              <p className="admin-hint">
                Nieuwe en gewijzigde afspraken komen vanzelf mee. Google ververst ongeveer twee keer per dag, Outlook
                elke paar uur, dus niet meteen. Deel deze link met niemand: wie hem heeft, ziet alle afspraken met
                namen en telefoonnummers. Een nieuw admin-wachtwoord maakt een nieuwe link.
              </p>
            </>
          )
        })()
      )}
    </section>
  )
}
