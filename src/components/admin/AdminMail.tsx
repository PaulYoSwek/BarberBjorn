import { useEffect, useRef, useState } from 'react'
import { humanDate, type MailKey } from '../../mail-templates'
import { fillTemplate } from '../../planning'
import { loadTemplates, sendClientMail, type InboxRow, type TemplateKey, type TemplateSave } from '../../planning-api'
import { serviceName, TEMPLATE_KEYS, TEMPLATE_LABEL } from './admin-defaults'
import { MailPreview } from './MailPreview'

type Props = {
  rows: InboxRow[]
  clientId?: string | null
  /** Template to open with, chosen to fit the booking ("Opnieuw mailen"). */
  templateKey?: TemplateKey | null
  onSent: (id: string) => void
}

function mailVars(row: InboxRow) {
  return {
    name: row.name,
    service: serviceName(row.service),
    date: humanDate(row.start.slice(0, 10), row.lang),
    time: row.start.slice(11, 16),
  }
}

export function AdminMail({ rows, clientId, templateKey, onSent }: Props) {
  const [templates, setTemplates] = useState<TemplateSave[]>([])
  const [selected, setSelected] = useState(clientId ?? '')
  const [key, setKey] = useState<TemplateKey | ''>(templateKey ?? '')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const applied = useRef('')

  useEffect(() => {
    if (clientId) setSelected(clientId)
    if (templateKey) setKey(templateKey)
  }, [clientId, templateKey])

  useEffect(() => {
    let cancelled = false
    loadTemplates()
      .then((next) => {
        if (cancelled) return
        if (!next.length) {
          setNotice('Sjablonen laden mislukt.')
          return
        }
        setTemplates(next)
      })
      .catch(() => {
        if (cancelled) return
        setNotice('Sjablonen laden mislukt.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!key) return
    const client = rows.find((item) => item.id === selected)
    // Mail in the language the client used on the site; Dutch when unknown.
    const wanted = client?.lang ?? 'nl'
    const template =
      templates.find((item) => item.key === key && item.lang === wanted) ??
      templates.find((item) => item.key === key && item.lang === 'nl')
    if (!template) return
    const stamp = `${selected}|${key}|${template.subject}|${template.body}`
    if (applied.current === stamp) return
    applied.current = stamp
    const vars = client ? mailVars(client) : null
    setSubject(vars ? fillTemplate(template.subject, vars) : template.subject)
    setBody(vars ? fillTemplate(template.body, vars) : template.body)
  }, [key, selected, templates, rows])

  async function send() {
    if (!selected || !key || busy) return
    setBusy(true)
    setDone(null)
    try {
      const result = await sendClientMail(selected, key, { subject, body })
      if (!result.ok) {
        setNotice('Mail versturen mislukt.')
        return
      }
      setNotice(null)
      const client = rows.find((item) => item.id === selected)
      setDone(`Mail verstuurd naar ${client?.email ?? 'de klant'}.`)
      onSent(selected)
    } catch {
      setNotice('Mail versturen mislukt.')
    } finally {
      setBusy(false)
    }
  }

  const clients = rows.filter((row) => row.email.trim())
  const client = rows.find((item) => item.id === selected)
  const ready = Boolean(selected && key)

  return (
    <div className="admin-settings admin-mail-tab">
      <header className="admin-agenda-head">
        <div>
          <p className="admin-kicker">Klanten</p>
          <h1>Mail</h1>
        </div>
        <p className="admin-settings-lead">
          Kies een klant en een sjabloon; de tekst wordt ingevuld met zijn afspraak en je kunt hem nog aanpassen voor je
          verstuurt.
        </p>
      </header>
      {notice ? <p className="admin-settings-alert" role="alert">{notice}</p> : null}
      {done ? <p className="admin-done" role="status">{done}</p> : null}
      {clients.length === 0 ? <p className="admin-hint">Nog geen klanten met een mailadres.</p> : null}
      <div className="admin-mail-compose">
        <div className="admin-mail-compose-grid">
          <label>
            <span>Klant</span>
            <select aria-label="Klant" value={selected} onChange={(event) => setSelected(event.target.value)}>
              <option value="">Kies een klant</option>
              {clients.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name} · {row.start.slice(0, 10)} {row.start.slice(11, 16)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Sjabloon</span>
            <select aria-label="Sjabloon" value={key} onChange={(event) => setKey(event.target.value as TemplateKey | '')}>
              <option value="">Kies een sjabloon</option>
              {TEMPLATE_KEYS.map((item) => (
                <option key={item} value={item}>
                  {TEMPLATE_LABEL[item]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {client ? (
          <dl className="admin-mail-to">
            <div>
              <dt>Aan</dt>
              <dd>
                {client.name} <span>&lt;{client.email}&gt;</span>
              </dd>
            </div>
            <div>
              <dt>Taal</dt>
              <dd>{client.lang === 'en' ? 'Engels' : 'Nederlands'}</dd>
            </div>
          </dl>
        ) : null}
        <label>
          <span>Onderwerp</span>
          <input aria-label="Onderwerp" value={subject} onChange={(event) => setSubject(event.target.value)} />
        </label>
        <label>
          <span>Bericht</span>
          <textarea aria-label="Bericht" rows={10} value={body} onChange={(event) => setBody(event.target.value)} />
        </label>
        <div className="admin-mail-compose-actions">
          <button type="button" className="admin-text-button admin-preview-button" disabled={!ready} onClick={() => setPreviewing(true)}>
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="8" cy="8" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            Voorbeeld
          </button>
          <button
            type="button"
            className="admin-primary admin-save-button"
            disabled={!ready || busy}
            onClick={() => {
              void send()
            }}
          >
            {busy ? 'Versturen…' : 'Verstuur'}
          </button>
        </div>
      </div>
      {previewing && key ? (
        <MailPreview
          mailKey={key as MailKey}
          label={TEMPLATE_LABEL[key]}
          lang={client?.lang ?? 'nl'}
          subject={subject}
          body={body}
          to={client?.email}
          onClose={() => setPreviewing(false)}
        />
      ) : null}
    </div>
  )
}
