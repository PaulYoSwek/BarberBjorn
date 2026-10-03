import { CONTACT } from '../content'

export function Footer() {
  return (
    <footer className="footer">
      <img src="/logo-wordmark.png?v=2" alt="BarberBjorn" />
      <p>{CONTACT.addressLine}</p>
      <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
      <a href="tel:+31612345678">{CONTACT.phone}</a>
    </footer>
  )
}
