import { Link } from 'react-router-dom'
import { CONTACT } from '../content'
import { useLang } from '../language'
import { mapsDirectionsUrl } from '../pin'
import { MapPanel } from './MapPanel'

/** Where the shop is and how to reach Bjorn, with the map beside it. */
export function Contact() {
  const { t, lang } = useLang()
  return (
    <section className="contact">
      <div className="contact-details">
        <p className="kicker">{t.contact.kicker}</p>
        <h2>{t.contact.title}</h2>
        <address>
          <p>
            <strong>{t.contact.addressLabel}</strong>
            <span>{CONTACT.addressFull}</span>
          </p>
          <p>
            <strong>{t.contact.phoneLabel}</strong>
            <a href={CONTACT.phoneHref}>{CONTACT.phone}</a>
          </p>
          <p>
            <strong>{t.contact.mailLabel}</strong>
            <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
          </p>
          <p>
            <strong>Instagram</strong>
            <a href={CONTACT.instagram} target="_blank" rel="noopener noreferrer me">
              {CONTACT.instagramHandle}
            </a>
          </p>
        </address>
        <p className="contact-note">{t.contact.note}</p>
        <div className="contact-actions">
          <Link className="book-link" to={lang === 'en' ? '/afspraak?lang=en' : '/afspraak'}>
            {t.nav.book}
          </Link>
          <a className="contact-route" href={mapsDirectionsUrl} target="_blank" rel="noopener noreferrer">
            {t.directionsCta}
          </a>
        </div>
      </div>
      <div className="contact-map">
        <MapPanel />
      </div>
    </section>
  )
}
