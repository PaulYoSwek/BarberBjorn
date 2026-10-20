import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useLang } from '../language'
import { LanguageSwitch } from './LanguageSwitch'

/** Every section has its own page; the home page shows them all in a row. */
export const SECTION_PATHS = {
  book: '/afspraak',
  services: '/diensten',
  about: '/over-bjorn',
  faq: '/vragen',
  contact: '/contact',
} as const

export function SiteHeader() {
  const { t, lang } = useLang()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)

  // A new page closes the phone menu.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const href = (path: string) => (lang === 'en' ? `${path}?lang=en` : path)
  const item = (path: string, label: string) => (
    <NavLink to={href(path)} className={({ isActive }) => (isActive ? 'is-on' : undefined)} end>
      {label}
    </NavLink>
  )

  return (
    <header className={`site-header${open ? ' is-open' : ''}`}>
      <div className="site-header-bar">
        <Link className="site-brand" to={href('/')} aria-label={t.nav.home}>
          <img src="/logo-mark-small.webp?v=4" alt="" width="40" height="23" decoding="async" />
          <span>Bjorn’s Barber</span>
        </Link>
        <nav id="site-nav" className="site-nav" aria-label={t.nav.menu}>
          {item(SECTION_PATHS.services, t.nav.services)}
          {item(SECTION_PATHS.about, t.nav.about)}
          {item(SECTION_PATHS.faq, t.nav.faq)}
          {item(SECTION_PATHS.contact, t.nav.contact)}
          <Link className="site-book" to={href(SECTION_PATHS.book)}>
            {t.nav.book}
          </Link>
        </nav>
        <LanguageSwitch />
        <button
          type="button"
          className="site-menu-toggle"
          aria-expanded={open}
          aria-controls="site-nav"
          aria-label={open ? t.nav.close : t.nav.menu}
          onClick={() => setOpen((value) => !value)}
        >
          <span aria-hidden="true">{open ? '×' : '☰'}</span>
        </button>
      </div>
    </header>
  )
}
