import { useEffect, useRef, useState } from 'react'
import {
  loadServices,
  loadTemplates,
  saveServices,
  saveTemplates,
  type ServiceSave,
  type TemplateSave,
} from '../../planning-api'
import {
  serviceName,
  TEMPLATE_SEED,
  TEMPLATE_KEYS,
  TEMPLATE_LABEL,
  TEMPLATE_LANGS,
  withServiceDefaults,
  withTemplateDefaults,
} from './admin-defaults'

function templatesToSave(loaded: TemplateSave[], current: TemplateSave[]): TemplateSave[] {
  return current.filter((item) => {
    const fromServer = loaded.some((row) => row.key === item.key && row.lang === item.lang)
    if (fromServer) return true
    const seed = TEMPLATE_SEED.find((row) => row.key === item.key && row.lang === item.lang)
    return !seed || item.subject !== seed.subject || item.body !== seed.body
  })
}

export function AdminSettings() {
  const [services, setServices] = useState<ServiceSave[]>([])
  const [templates, setTemplates] = useState<TemplateSave[]>([])
  const [servicesReady, setServicesReady] = useState(false)
  const [templatesReady, setTemplatesReady] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const loadedTemplates = useRef<TemplateSave[]>([])

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([loadServices(), loadTemplates()]).then(([serviceResult, templateResult]) => {
      if (cancelled) return
      const problems: string[] = []
      if (serviceResult.status === 'fulfilled') {
        setServices(withServiceDefaults(serviceResult.value))
        setServicesReady(true)
      } else {
        problems.push('Diensten laden mislukt.')
      }
      if (templateResult.status === 'fulfilled' && templateResult.value.length > 0) {
        loadedTemplates.current = templateResult.value
        setTemplates(withTemplateDefaults(templateResult.value))
        setTemplatesReady(true)
      } else {
        loadedTemplates.current = []
        setTemplatesReady(false)
        problems.push('Sjablonen laden mislukt.')
      }
      setNotice(problems.length ? problems.join(' ') : null)
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  function patchService(id: ServiceSave['id'], patch: Partial<Pick<ServiceSave, 'price' | 'minutes'>>) {
    setServices((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  /** The agenda runs in quarter-hours, so a length snaps to the nearest one (at least 15). */
  function snapMinutes(id: ServiceSave['id']) {
    setServices((current) =>
      current.map((item) =>
        item.id === id ? { ...item, minutes: Math.max(15, Math.round(item.minutes / 15) * 15) } : item,
      ),
    )
  }

  function patchTemplate(key: TemplateSave['key'], lang: TemplateSave['lang'], patch: Partial<Pick<TemplateSave, 'subject' | 'body'>>) {
    setTemplates((current) =>
      current.map((item) => (item.key === key && item.lang === lang ? { ...item, ...patch } : item)),
    )
  }

  async function save() {
    if (busy) return
    setBusy(true)
    setDone(null)
    try {
      const jobs: Promise<{ ok: true } | { ok: false; error: string }>[] = []
      const snapped = services.map((item) => ({ ...item, minutes: Math.max(15, Math.round(item.minutes / 15) * 15) }))
      if (servicesReady) {
        setServices(snapped)
        jobs.push(saveServices(snapped))
      }
      if (templatesReady) {
        const payload = templatesToSave(loadedTemplates.current, templates)
        if (payload.length > 0) jobs.push(saveTemplates(payload))
      }
      const results = await Promise.all(jobs)
      const ok = results.every((result) => result.ok)
      setNotice(ok ? null : 'Opslaan mislukt.')
      if (ok) setDone('Opgeslagen. De site gebruikt de nieuwe prijzen en tijden meteen.')
    } catch {
      setNotice('Opslaan mislukt.')
    } finally {
      setBusy(false)
    }
  }

  if (!servicesReady && !templatesReady) {
    if (!loaded) return <p className="admin-hint">Instellingen laden…</p>
    return notice ? <p role="alert">{notice}</p> : null
  }

  return (
    <div className="admin-form">
      <header className="admin-agenda-head">
        <div>
          <p className="admin-kicker">Prijzen, tijden en mail</p>
          <h1>Settings</h1>
        </div>
      </header>
      {notice ? <p role="alert">{notice}</p> : null}
      {done ? <p className="admin-done" role="status">{done}</p> : null}
      {servicesReady
        ? services.map((service) => {
        const name = serviceName(service.id)
        return (
          <fieldset key={service.id} className="admin-field">
            <legend>{name}</legend>
            <label>
              Prijs
              <input
                aria-label={`${name} prijs`}
                value={service.price}
                onChange={(event) => patchService(service.id, { price: event.target.value })}
              />
            </label>
            <label>
              Minuten
              <input
                aria-label={`${name} minuten`}
                inputMode="numeric"
                value={service.minutes}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  if (Number.isFinite(next)) patchService(service.id, { minutes: next })
                }}
                onBlur={() => snapMinutes(service.id)}
              />
              <span className="admin-field-hint">Per kwartier: 15, 30, 45, 60, 75 …</span>
            </label>
          </fieldset>
        )
      })
        : null}
      {templatesReady
        ? TEMPLATE_KEYS.map((key) => (
        <fieldset key={key} className="admin-field">
          <legend>{TEMPLATE_LABEL[key]}</legend>
          {TEMPLATE_LANGS.map((lang) => {
            const item = templates.find((row) => row.key === key && row.lang === lang)
            if (!item) return null
            const label = TEMPLATE_LABEL[key]
            return (
              <div key={lang}>
                <label>
                  Onderwerp {lang}
                  <input
                    aria-label={`${label} ${lang} onderwerp`}
                    value={item.subject}
                    onChange={(event) => patchTemplate(key, lang, { subject: event.target.value })}
                  />
                </label>
                <label>
                  Bericht {lang}
                  <textarea
                    aria-label={`${label} ${lang} bericht`}
                    rows={4}
                    value={item.body}
                    onChange={(event) => patchTemplate(key, lang, { body: event.target.value })}
                  />
                </label>
              </div>
            )
          })}
        </fieldset>
      ))
        : null}
      <button type="button" className="admin-primary" disabled={(!servicesReady && !templatesReady) || busy} onClick={() => { void save() }}>
        {busy ? 'Opslaan…' : 'Opslaan'}
      </button>
    </div>
  )
}
