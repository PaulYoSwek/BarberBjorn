import { CONTACT, CREDIT } from '../content'
import { useLang } from '../language'

const YEAR = new Date().getFullYear()

export function Footer() {
  const { t, lang } = useLang()
  const year = YEAR
  return (
    <footer className="footer">
      <div className="footer-main">
        <img src="/logo-wordmark.png?v=3" alt="Bjorn’s Barber" width="132" height="125" loading="lazy" decoding="async" />
        <address className="footer-contact">
          <p>{CONTACT.addressLine}</p>
          <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
          <a href={CONTACT.phoneHref}>{CONTACT.phone}</a>
          <a
            className="footer-instagram"
            href={CONTACT.instagram}
            target="_blank"
            rel="noopener noreferrer me"
            aria-label={`Instagram ${CONTACT.instagramHandle}`}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="17.4" cy="6.6" r="1.2" fill="currentColor" />
            </svg>
            {CONTACT.instagramHandle}
          </a>
        </address>
      </div>
      <div className="footer-meta">
        <p>
          © {year} Bjorn’s Barber ·{' '}
          <a className="footer-privacy" href={lang === 'en' ? '/privacy?lang=en' : '/privacy'}>
            {t.footerPrivacy}
          </a>
        </p>
        <p className="footer-credit">
          {t.creditLabel}{' '}
          <a href={CREDIT.url} target="_blank" rel="noopener" title={`${CREDIT.name} · Digitale oplossingen op maat`}>
            {CREDIT.name}
          </a>
        </p>
      </div>
    </footer>
  )
}
