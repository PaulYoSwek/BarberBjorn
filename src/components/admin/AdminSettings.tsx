import { useEffect, useRef, useState } from 'react'
import {
  deleteService,
  loadServices,
  loadTemplates,
  saveServices,
  saveTemplates,
  type ServiceSave,
  type TemplateSave,
} from '../../planning-api'
import { euroLabel } from '../../clients'
import { newServiceId, setServiceCatalog } from '../../service-catalog'
import {
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

function snap(minutes: number): number {
  return Math.max(15, Math.round(minutes / 15) * 15)
}

type Props = { onServicesSaved?: () => void }

export function AdminSettings({ onServicesSaved }: Props = {}) {
  const [services, setServices] = useState<ServiceSave[]>([])
  const [templates, setTemplates] = useState<TemplateSave[]>([])
  const [servicesReady, setServicesReady] = useState(false)
  const [templatesReady, setTemplatesReady] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [confirming, setConfirming] = useState<string | null>(null)
  const loadedTemplates = useRef<TemplateSave[]>([])
  /** Services added on this screen and not saved yet; they get a real id from their name on save. */
  const fresh = useRef(new Set<string>())
  const counter = useRef(0)

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

  function patchService(id: string, patch: Partial<ServiceSave>) {
    setServices((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  function patchText(id: string, field: 'name' | 'detail', lang: 'nl' | 'en', value: string) {
    setServices((current) =>
      current.map((item) => (item.id === id ? { ...item, [field]: { ...item[field], [lang]: value } } : item)),
    )
  }

  /** The agenda runs in quarter-hours, so a length snaps to the nearest one (at least 15). */
  function snapMinutes(id: string) {
    setServices((current) => current.map((item) => (item.id === id ? { ...item, minutes: snap(item.minutes) } : item)))
  }

  function move(id: string, step: -1 | 1) {
    setServices((current) => {
      const index = current.findIndex((item) => item.id === id)
      const target = index + step
      if (index < 0 || target < 0 || target >= current.length) return current
      const next = current.slice()
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function addService() {
    counter.current += 1
    const id = `nieuw-${counter.current}`
    fresh.current.add(id)
    setServices((current) => [
      ...current,
      {
        id,
        price: '',
        minutes: 30,
        name: { nl: '', en: '' },
        detail: { nl: '', en: '' },
        sort: current.length + 1,
        active: true,
      },
    ])
    setDone(null)
  }

  async function removeService(service: ServiceSave) {
    setConfirming(null)
    if (fresh.current.has(service.id)) {
      fresh.current.delete(service.id)
      setServices((current) => current.filter((item) => item.id !== service.id))
      return
    }
    setBusy(true)
    setDone(null)
    try {
      const result = await deleteService(service.id)
      if (!result.ok) {
        setNotice('Verwijderen mislukt.')
        return
      }
      setNotice(null)
      if (result.hidden) {
        patchService(service.id, { active: false })
        setDone(`${service.name.nl} staat op afspraken en is daarom verborgen in plaats van verwijderd.`)
      } else {
        setServices((current) => current.filter((item) => item.id !== service.id))
        setDone(`${service.name.nl} is verwijderd.`)
      }
      onServicesSaved?.()
    } finally {
      setBusy(false)
    }
  }

  function patchTemplate(key: TemplateSave['key'], lang: TemplateSave['lang'], patch: Partial<Pick<TemplateSave, 'subject' | 'body'>>) {
    setTemplates((current) =>
      current.map((item) => (item.key === key && item.lang === lang ? { ...item, ...patch } : item)),
    )
  }

  async function save() {
    if (busy) return
    if (servicesReady) {
      if (services.some((item) => !item.name.nl.trim())) return setNotice('Geef elke dienst een naam.')
      if (services.some((item) => !item.price.trim())) return setNotice('Geef elke dienst een prijs.')
      if (!services.some((item) => item.active)) return setNotice('Laat minstens één dienst zichtbaar op de website.')
    }
    setBusy(true)
    setDone(null)
    try {
      const jobs: Promise<{ ok: true } | { ok: false; error: string }>[] = []
      let snapped = services
      if (servicesReady) {
        const taken = services.filter((item) => !fresh.current.has(item.id)).map((item) => item.id)
        snapped = services.map((item, index) => {
          let id = item.id
          if (fresh.current.has(item.id)) {
            id = newServiceId(item.name.nl, taken)
            taken.push(id)
          }
          return {
            ...item,
            id,
            price: euroLabel(item.price.trim()),
            minutes: snap(item.minutes),
            name: { nl: item.name.nl.trim(), en: item.name.en.trim() },
            detail: { nl: item.detail.nl.trim(), en: item.detail.en.trim() },
            sort: index + 1,
          }
        })
        jobs.push(saveServices(snapped))
      }
      if (templatesReady) {
        const payload = templatesToSave(loadedTemplates.current, templates)
        if (payload.length > 0) jobs.push(saveTemplates(payload))
      }
      const results = await Promise.all(jobs)
      const ok = results.every((result) => result.ok)
      setNotice(ok ? null : 'Opslaan mislukt.')
      if (ok) {
        if (servicesReady) {
          fresh.current.clear()
          setServices(snapped)
          setServiceCatalog(snapped)
          onServicesSaved?.()
        }
        setDone('Opgeslagen. De website toont de diensten, prijzen en tijden meteen.')
      }
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
          <p className="admin-kicker">Diensten, prijzen en mail</p>
          <h1>Settings</h1>
        </div>
      </header>
      {notice ? <p role="alert">{notice}</p> : null}
      {done ? <p className="admin-done" role="status">{done}</p> : null}
      {servicesReady ? (
        <section className="admin-services" aria-label="Diensten">
          <h2 className="admin-section-title">Diensten</h2>
          <p className="admin-hint">
            Wat hier zichtbaar staat, staat op de website en is te boeken. De eerste drie zijn de grote prijsborden;
            de rest komt eronder.
          </p>
          {services.map((service, index) => {
            const name = service.name.nl.trim() || 'Nieuwe dienst'
            return (
              <fieldset key={service.id} className={`admin-field admin-service${service.active ? '' : ' is-hidden'}`}>
                <legend>
                  {name}
                  {service.active ? null : <span className="admin-service-tag">verborgen</span>}
                </legend>
                <div className="admin-service-grid">
                  <label>
                    Naam
                    <input
                      aria-label={`${name} naam`}
                      value={service.name.nl}
                      maxLength={60}
                      placeholder="Bijv. Kinderen knippen"
                      onChange={(event) => patchText(service.id, 'name', 'nl', event.target.value)}
                    />
                  </label>
                  <label>
                    Naam Engels (mag leeg)
                    <input
                      aria-label={`${name} naam Engels`}
                      value={service.name.en}
                      maxLength={60}
                      onChange={(event) => patchText(service.id, 'name', 'en', event.target.value)}
                    />
                  </label>
                  <label>
                    Omschrijving (mag leeg)
                    <input
                      aria-label={`${name} omschrijving`}
                      value={service.detail.nl}
                      maxLength={120}
                      onChange={(event) => patchText(service.id, 'detail', 'nl', event.target.value)}
                    />
                  </label>
                  <label>
                    Omschrijving Engels (mag leeg)
                    <input
                      aria-label={`${name} omschrijving Engels`}
                      value={service.detail.en}
                      maxLength={120}
                      onChange={(event) => patchText(service.id, 'detail', 'en', event.target.value)}
                    />
                  </label>
                  <label>
                    Prijs
                    <input
                      aria-label={`${name} prijs`}
                      value={service.price}
                      inputMode="decimal"
                      placeholder="€25"
                      onChange={(event) => patchService(service.id, { price: event.target.value })}
                      onBlur={() => patchService(service.id, { price: euroLabel(service.price.trim()) })}
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
                </div>
                <div className="admin-service-actions">
                  <label className="admin-check">
                    <input
                      type="checkbox"
                      aria-label={`${name} zichtbaar op de website`}
                      checked={service.active}
                      onChange={(event) => patchService(service.id, { active: event.target.checked })}
                    />
                    Zichtbaar op de website
                  </label>
                  <button type="button" aria-label={`${name} omhoog`} disabled={index === 0} onClick={() => move(service.id, -1)}>
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`${name} omlaag`}
                    disabled={index === services.length - 1}
                    onClick={() => move(service.id, 1)}
                  >
                    ↓
                  </button>
                  {confirming === service.id ? (
                    <>
                      <button type="button" className="is-danger" disabled={busy} onClick={() => void removeService(service)}>
                        Echt verwijderen
                      </button>
                      <button type="button" onClick={() => setConfirming(null)}>
                        Annuleren
                      </button>
                    </>
                  ) : (
                    <button type="button" aria-label={`${name} verwijderen`} onClick={() => setConfirming(service.id)}>
                      Verwijderen
                    </button>
                  )}
                </div>
              </fieldset>
            )
          })}
          <button type="button" className="admin-add-service" onClick={addService}>
            + Dienst toevoegen
          </button>
        </section>
      ) : null}
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
