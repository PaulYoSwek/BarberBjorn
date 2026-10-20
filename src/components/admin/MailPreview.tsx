import { useEffect, useState } from 'react'
import { CONTACT, type Lang } from '../../content'
import { mailButton, mailHtml } from '../../mail-html'
import { fillTemplate } from '../../planning'
import { humanDate, type MailKey } from '../../mail-templates'

type Props = {
  mailKey: MailKey
  label: string
  lang: Lang
  subject: string
  body: string
  /** The service name shown in the sample, in the mail's language. */
  service?: string
  /** The real recipient; without one the mail goes to a sample address with sample data filled in. */
  to?: string
  onClose: () => void
}

export const SAMPLE_NAME: Record<Lang, string> = { nl: 'Jan', en: 'James' }
export const SAMPLE_TO = 'jan@voorbeeld.nl'
export const SENDER = 'info@bjornsbarber.nl'

/** The next Friday from today, as yyyy-mm-dd: a believable sample date. */
function nextFriday(now = new Date()): string {
  const day = new Date(now)
  day.setDate(day.getDate() + ((5 - day.getDay() + 7) % 7 || 7))
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
}

/** The template with sample data filled in, the way the server does it for a real booking. */
export function sampleMail(subject: string, body: string, lang: Lang, service: string) {
  const vars = { name: SAMPLE_NAME[lang], service, date: humanDate(nextFriday(), lang), time: '14:00' }
  return { subject: fillTemplate(subject, vars), text: fillTemplate(body, vars) }
}

/** The first real line after the greeting: what Gmail and Outlook show next to the subject. */
function preheaderOf(text: string): string {
  return text.trim().split('\n').find((line) => line.trim() && !/^(hoi|hi)\b/i.test(line.trim()))?.trim() ?? ''
}

/** A client's inbox with this mail in it, then the mail itself as it is really sent. */
export function MailPreview({ mailKey, label, lang, subject, body, service, to, onClose }: Props) {
  const [height, setHeight] = useState(560)
  const [device, setDevice] = useState<'desktop' | 'phone'>('desktop')
  const filled = to ? { subject, text: body } : sampleMail(subject, body, lang, service ?? '')
  const html = mailHtml(filled.text, lang, filled.subject, mailButton(mailKey, lang))

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="admin-modal" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <section className="admin-mail-preview" role="dialog" aria-modal="true" aria-label={`Voorbeeld ${label} ${lang}`}>
        <header className="admin-mail-preview-head">
          <div>
            <p className="admin-kicker">Voorbeeld · {lang === 'nl' ? 'Nederlands' : 'Engels'}</p>
            <h2>{label}</h2>
            <p className="admin-hint">
              {to ? `Zo komt deze mail binnen bij ${to}.` : 'Zo komt deze mail binnen bij de klant, met voorbeeldgegevens ingevuld.'}
            </p>
          </div>
          <div className="admin-segment admin-mail-preview-device" role="radiogroup" aria-label="Weergave">
            <button type="button" role="radio" aria-checked={device === 'desktop'} onClick={() => setDevice('desktop')}>
              Computer
            </button>
            <button type="button" role="radio" aria-checked={device === 'phone'} onClick={() => setDevice('phone')}>
              Telefoon
            </button>
          </div>
          <button type="button" className="admin-detail-close" aria-label="Sluiten" onClick={onClose}>
            ×
          </button>
        </header>

        <div className={`admin-inbox-mock${device === 'phone' ? ' is-phone' : ''}`}>
          <p className="admin-inbox-mock-title">Inbox</p>
          <div className="admin-inbox-mock-row is-unread">
            <span className="admin-inbox-mock-avatar" aria-hidden="true">
              B
            </span>
            <div className="admin-inbox-mock-text">
              <div className="admin-inbox-mock-line">
                <strong>Bjorn’s Barber</strong>
                <span>14:02</span>
              </div>
              <p>
                <strong>{filled.subject}</strong>
                <span> – {preheaderOf(filled.text)}</span>
              </p>
            </div>
          </div>
          <div className="admin-inbox-mock-row">
            <span className="admin-inbox-mock-avatar is-other" aria-hidden="true">
              M
            </span>
            <div className="admin-inbox-mock-text">
              <div className="admin-inbox-mock-line">
                <span>Marieke</span>
                <span>gisteren</span>
              </div>
              <p>
                <span>Foto’s van zaterdag – Hoi, hier zijn ze…</span>
              </p>
            </div>
          </div>
        </div>

        <div className={`admin-mail-mock${device === 'phone' ? ' is-phone' : ''}`}>
          <div className="admin-mail-mock-head">
            <h3>{filled.subject}</h3>
            <dl>
              <div>
                <dt>Van</dt>
                <dd>
                  Bjorn’s Barber <span>&lt;{SENDER}&gt;</span>
                </dd>
              </div>
              <div>
                <dt>Aan</dt>
                <dd>{to ?? SAMPLE_TO}</dd>
              </div>
              <div>
                <dt>Antwoord gaat naar</dt>
                <dd>{CONTACT.email}</dd>
              </div>
            </dl>
          </div>
          <iframe
            className="admin-mail-mock-frame"
            title={`Mail ${label} ${lang}`}
            srcDoc={html}
            sandbox="allow-same-origin"
            style={{ height }}
            onLoad={(event) => {
              const doc = event.currentTarget.contentDocument
              const size = doc?.documentElement?.scrollHeight ?? 0
              if (size > 0) setHeight(size + 8)
            }}
          />
        </div>

        <div className="admin-detail-actions">
          <button type="button" onClick={onClose}>
            Sluiten
          </button>
        </div>
      </section>
    </div>
  )
}
