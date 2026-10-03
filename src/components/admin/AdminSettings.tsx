import { useEffect, useState } from 'react'
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
  TEMPLATE_KEYS,
  TEMPLATE_LABEL,
  TEMPLATE_LANGS,
  withServiceDefaults,
  withTemplateDefaults,
} from './admin-defaults'

export function AdminSettings() {
  const [services, setServices] = useState<ServiceSave[]>([])
  const [templates, setTemplates] = useState<TemplateSave[]>([])
  const [servicesReady, setServicesReady] = useState(false)
  const [templatesReady, setTemplatesReady] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

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
      if (templateResult.status === 'fulfilled') {
        setTemplates(withTemplateDefaults(templateResult.value))
        setTemplatesReady(true)
      } else {
        problems.push('Sjablonen laden mislukt.')
      }
      setNotice(problems.length ? problems.join(' ') : null)
    })
    return () => {
      cancelled = true
    }
  }, [])

  function patchService(id: ServiceSave['id'], patch: Partial<Pick<ServiceSave, 'price' | 'minutes'>>) {
    setServices((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  function patchTemplate(key: TemplateSave['key'], lang: TemplateSave['lang'], patch: Partial<Pick<TemplateSave, 'subject' | 'body'>>) {
    setTemplates((current) =>
      current.map((item) => (item.key === key && item.lang === lang ? { ...item, ...patch } : item)),
    )
  }

  async function save() {
    try {
      const jobs: Promise<{ ok: true } | { ok: false; error: string }>[] = []
      if (servicesReady) jobs.push(saveServices(services))
      if (templatesReady) jobs.push(saveTemplates(templates))
      const results = await Promise.all(jobs)
      setNotice(results.every((result) => result.ok) ? null : 'Opslaan mislukt.')
    } catch {
      setNotice('Opslaan mislukt.')
    }
  }

  if (!servicesReady && !templatesReady) {
    return notice ? <p role="alert">{notice}</p> : null
  }

  return (
    <div className="admin-form">
      {notice ? <p role="alert">{notice}</p> : null}
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
              />
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
      <button type="button" className="admin-primary" disabled={!servicesReady && !templatesReady} onClick={() => { void save() }}>
        Opslaan
      </button>
    </div>
  )
}
