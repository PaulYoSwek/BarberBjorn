import { useEffect, useRef, useState } from 'react'
import { fillTemplate } from '../../planning'
import { loadTemplates, sendClientMail, type InboxRow, type TemplateKey, type TemplateSave } from '../../planning-api'
import { serviceName } from './admin-defaults'

type Props = {
  rows: InboxRow[]
  clientId?: string | null
  onSent: (id: string) => void
}

function mailVars(row: InboxRow) {
  return {
    name: row.name,
    service: serviceName(row.service),
    date: row.start.slice(0, 10),
    time: row.start.slice(11, 16),
  }
}

export function AdminMail({ rows, clientId, onSent }: Props) {
  const [templates, setTemplates] = useState<TemplateSave[]>([])
  const [selected, setSelected] = useState(clientId ?? '')
  const [key, setKey] = useState<TemplateKey | ''>('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const applied = useRef('')

  useEffect(() => {
    if (clientId) setSelected(clientId)
  }, [clientId])

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
    const template = templates.find((item) => item.key === key && item.lang === 'nl')
    if (!template) return
    const stamp = `${selected}|${key}|${template.subject}|${template.body}`
    if (applied.current === stamp) return
    applied.current = stamp
    const client = rows.find((item) => item.id === selected)
    const vars = client ? mailVars(client) : null
    setSubject(vars ? fillTemplate(template.subject, vars) : template.subject)
    setBody(vars ? fillTemplate(template.body, vars) : template.body)
  }, [key, selected, templates, rows])

  async function send() {
    if (!selected || !key) return
    try {
      const result = await sendClientMail(selected, key, { subject, body })
      if (!result.ok) {
        setNotice('Mail versturen mislukt.')
        return
      }
      setNotice(null)
      onSent(selected)
    } catch {
      setNotice('Mail versturen mislukt.')
    }
  }

  const clients = rows.filter((row) => row.email.trim())

  return (
    <div className="admin-form">
      {notice ? <p role="alert">{notice}</p> : null}
      <label>
        Klant
        <select aria-label="Klant" value={selected} onChange={(event) => setSelected(event.target.value)}>
          <option value="">Kies een klant</option>
          {clients.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Sjabloon
        <select
          aria-label="Sjabloon"
          value={key}
          onChange={(event) => setKey(event.target.value as TemplateKey | '')}
        >
          <option value="">Kies een sjabloon</option>
          <option value="thanks">Bedankt</option>
          <option value="accepted">Bevestigd</option>
          <option value="declined">Geweigerd</option>
        </select>
      </label>
      <label>
        Onderwerp
        <input aria-label="Onderwerp" value={subject} onChange={(event) => setSubject(event.target.value)} />
      </label>
      <label>
        Bericht
        <textarea aria-label="Bericht" value={body} onChange={(event) => setBody(event.target.value)} />
      </label>
      <button type="button" className="admin-primary" disabled={!selected || !key} onClick={() => { void send() }}>
        Verstuur
      </button>
    </div>
  )
}
