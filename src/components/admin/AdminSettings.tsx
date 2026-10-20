import { useEffect, useRef, useState } from 'react'
import type { Lang } from '../../content'
import { serviceLabel } from '../../service-catalog'
import { MailPreview } from './MailPreview'
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

/** When each mail goes out, in Bjorn's words. */
const MAIL_WHEN: Partial<Record<TemplateSave['key'], string>> = {
  thanks: 'Meteen nadat een klant op de website boekt.',
  received: 'Als een klant om een ander tijdstip vraagt en jij nog moet beslissen.',
  accepted: 'Als jij zo’n aanvraag accepteert.',
  declined: 'Als jij zo’n aanvraag weigert.',
  moved: 'Als jij een afspraak naar een ander moment verplaatst.',
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
  const [preview, setPreview] = useState<{ key: TemplateSave['key']; lang: Lang } | null>(null)
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
    requestAnimationFrame(() => document.getElementById(`service-${id}`)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }))
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

  const previewRow = preview ? templates.find((row) => row.key === preview.key && row.lang === preview.lang) : null
  const sampleService = (lang: Lang) => {
    const first = services.find((item) => item.active) ?? services[0]
    return first ? first.name[lang].trim() || first.name.nl.trim() || serviceLabel('cut', lang) : serviceLabel('cut', lang)
  }

  return (
    <div className="admin-settings">
      <header className="admin-agenda-head">
        <div>
          <p className="admin-kicker">Diensten, prijzen en mail</p>
          <h1>Instellingen</h1>
        </div>
        <p className="admin-settings-lead">
          Wat je hier verandert staat na opslaan meteen op de website en in de mails naar klanten.
        </p>
      </header>
      {notice ? <p className="admin-settings-alert" role="alert">{notice}</p> : null}
      {done ? <p className="admin-done" role="status">{done}</p> : null}

      {servicesReady ? (
        <section className="admin-settings-section" aria-label="Diensten">
          <div className="admin-settings-title">
            <div>
              <h2>Diensten</h2>
              <p className="admin-hint">
                Wat hier aan staat, staat op de website en is te boeken. De eerste drie zijn de grote prijsborden; de rest
                komt eronder.
              </p>
            </div>
            <button type="button" className="admin-add-service" onClick={addService}>
              + Dienst toevoegen
            </button>
          </div>
          <ol className="admin-service-list">
            {services.map((service, index) => {
              const name = service.name.nl.trim() || 'Nieuwe dienst'
              const facts = [service.price.trim() || 'nog geen prijs', `${service.minutes} min`]
              return (
                <li
                  key={service.id}
                  id={`service-${service.id}`}
                  className={`admin-service-card${service.active ? '' : ' is-hidden'}${index < 3 ? ' is-board' : ''}`}
                >
                  <header className="admin-service-head">
                    <span className="admin-service-no" aria-hidden="true">
                      {index + 1}
                    </span>
                    <div className="admin-service-who">
                      <h3>{name}</h3>
                      <p>
                        {facts.join(' · ')}
                        {index < 3 ? <span className="admin-service-tag is-board">Prijsbord</span> : null}
                        {service.active ? null : <span className="admin-service-tag">Verborgen</span>}
                      </p>
                    </div>
                    <div className="admin-service-tools">
                      <button
                        type="button"
                        className="admin-icon-button"
                        aria-label={`${name} omhoog`}
                        disabled={index === 0}
                        onClick={() => move(service.id, -1)}
                      >
                        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                          <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="admin-icon-button"
                        aria-label={`${name} omlaag`}
                        disabled={index === services.length - 1}
                        onClick={() => move(service.id, 1)}
                      >
                        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                          <path d="M8 3v10M3.5 8.5 8 13l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      {confirming === service.id ? (
                        <>
                          <button type="button" className="admin-text-button is-danger" disabled={busy} onClick={() => void removeService(service)}>
                            Echt verwijderen
                          </button>
                          <button type="button" className="admin-text-button" onClick={() => setConfirming(null)}>
                            Annuleren
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="admin-text-button"
                          aria-label={`${name} verwijderen`}
                          onClick={() => setConfirming(service.id)}
                        >
                          Verwijderen
                        </button>
                      )}
                    </div>
                  </header>
                  <div className="admin-service-grid">
                    <label>
                      <span>Naam</span>
                      <input
                        aria-label={`${name} naam`}
                        value={service.name.nl}
                        maxLength={60}
                        placeholder="Bijv. Kinderen knippen"
                        onChange={(event) => patchText(service.id, 'name', 'nl', event.target.value)}
                      />
                    </label>
                    <label>
                      <span>
                        Naam Engels <small>mag leeg</small>
                      </span>
                      <input
                        aria-label={`${name} naam Engels`}
                        value={service.name.en}
                        maxLength={60}
                        onChange={(event) => patchText(service.id, 'name', 'en', event.target.value)}
                      />
                    </label>
                    <label>
                      <span>
                        Omschrijving <small>mag leeg</small>
                      </span>
                      <input
                        aria-label={`${name} omschrijving`}
                        value={service.detail.nl}
                        maxLength={120}
                        onChange={(event) => patchText(service.id, 'detail', 'nl', event.target.value)}
                      />
                    </label>
                    <label>
                      <span>
                        Omschrijving Engels <small>mag leeg</small>
                      </span>
                      <input
                        aria-label={`${name} omschrijving Engels`}
                        value={service.detail.en}
                        maxLength={120}
                        onChange={(event) => patchText(service.id, 'detail', 'en', event.target.value)}
                      />
                    </label>
                    <label className="is-short">
                      <span>Prijs</span>
                      <input
                        aria-label={`${name} prijs`}
                        value={service.price}
                        inputMode="decimal"
                        placeholder="€25"
                        onChange={(event) => patchService(service.id, { price: event.target.value })}
                        onBlur={() => patchService(service.id, { price: euroLabel(service.price.trim()) })}
                      />
                    </label>
                    <label className="is-short">
                      <span>
                        Duur in minuten <small>per kwartier: 15, 30, 45 …</small>
                      </span>
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
                    </label>
                    <label className="admin-switch">
                      <input
                        type="checkbox"
                        aria-label={`${name} zichtbaar op de website`}
                        checked={service.active}
                        onChange={(event) => patchService(service.id, { active: event.target.checked })}
                      />
                      <span className="admin-switch-track" aria-hidden="true" />
                      <span className="admin-switch-text">Zichtbaar op de website</span>
                    </label>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      ) : null}

      {templatesReady ? (
        <section className="admin-settings-section" aria-label="E-mails">
          <div className="admin-settings-title">
            <div>
              <h2>E-mails naar klanten</h2>
              <p className="admin-hint">
                Deze mails gaan automatisch, in de taal waarin de klant boekte. Klik op <strong>Voorbeeld</strong> om te zien
                hoe de mail er in de inbox uitziet.
              </p>
            </div>
          </div>
          <dl className="admin-mail-vars" aria-label="Invulvelden">
            <div>
              <dt>{'{{name}}'}</dt>
              <dd>naam van de klant</dd>
            </div>
            <div>
              <dt>{'{{service}}'}</dt>
              <dd>de dienst</dd>
            </div>
            <div>
              <dt>{'{{date}}'}</dt>
              <dd>de dag, bijv. vrijdag 24 oktober</dd>
            </div>
            <div>
              <dt>{'{{time}}'}</dt>
              <dd>het tijdstip</dd>
            </div>
          </dl>
          <ol className="admin-mail-list">
            {TEMPLATE_KEYS.map((key, index) => {
              const label = TEMPLATE_LABEL[key]
              return (
                <li key={key} className="admin-mail-card">
                  <header className="admin-service-head">
                    <span className="admin-service-no" aria-hidden="true">
                      {index + 1}
                    </span>
                    <div className="admin-service-who">
                      <h3>{label}</h3>
                      <p>{MAIL_WHEN[key] ?? ''}</p>
                    </div>
                  </header>
                  <div className="admin-mail-langs">
                    {TEMPLATE_LANGS.map((lang) => {
                      const item = templates.find((row) => row.key === key && row.lang === lang)
                      if (!item) return null
                      return (
                        <div key={lang} className="admin-mail-lang">
                          <div className="admin-mail-lang-head">
                            <span className="admin-lang-tag">{lang === 'nl' ? 'Nederlands' : 'Engels'}</span>
                            <button
                              type="button"
                              className="admin-text-button admin-preview-button"
                              aria-label={`${label} ${lang} voorbeeld`}
                              onClick={() => setPreview({ key, lang })}
                            >
                              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                                <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
                                <circle cx="8" cy="8" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                              </svg>
                              Voorbeeld
                            </button>
                          </div>
                          <label>
                            <span>Onderwerp</span>
                            <input
                              aria-label={`${label} ${lang} onderwerp`}
                              value={item.subject}
                              onChange={(event) => patchTemplate(key, lang, { subject: event.target.value })}
                            />
                          </label>
                          <label>
                            <span>Bericht</span>
                            <textarea
                              aria-label={`${label} ${lang} bericht`}
                              rows={9}
                              value={item.body}
                              onChange={(event) => patchTemplate(key, lang, { body: event.target.value })}
                            />
                          </label>
                        </div>
                      )
                    })}
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      ) : null}

      <div className="admin-save-bar">
        <p className="admin-hint">{busy ? 'Bezig met opslaan…' : 'Wijzigingen staan pas vast na opslaan.'}</p>
        <button
          type="button"
          className="admin-primary admin-save-button"
          disabled={(!servicesReady && !templatesReady) || busy}
          onClick={() => {
            void save()
          }}
        >
          {busy ? 'Opslaan…' : 'Opslaan'}
        </button>
      </div>

      {preview && previewRow ? (
        <MailPreview
          mailKey={preview.key}
          label={TEMPLATE_LABEL[preview.key]}
          lang={preview.lang}
          subject={previewRow.subject}
          body={previewRow.body}
          service={sampleService(preview.lang)}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </div>
  )
}
