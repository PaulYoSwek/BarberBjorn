import { CONTACT, CREDIT } from '../content'
import { useLang } from '../language'

const YEAR = new Date().getFullYear()

export function Footer() {
  const { t } = useLang()
  const year = YEAR
  return (
    <footer className="footer">
      <div className="footer-main">
        <img src="/logo-wordmark.png?v=3" alt="Bjorn’s Barber" width="132" height="125" loading="lazy" decoding="async" />
        <address className="footer-contact">
          <p>{CONTACT.addressLine}</p>
          <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
          <a href="tel:+31612345678">{CONTACT.phone}</a>
        </address>
      </div>
      <div className="footer-meta">
        <p>© {year} Bjorn’s Barber</p>
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
