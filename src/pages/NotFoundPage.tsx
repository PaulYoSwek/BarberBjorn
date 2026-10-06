import { Link } from 'react-router-dom'
import { LanguageSwitch } from '../components/LanguageSwitch'
import { useLang } from '../language'
import { useHeadTags } from '../seo'

export function NotFoundPage() {
  const { t, lang } = useLang()
  useHeadTags({ title: `404 · BarberBjorn`, robots: 'noindex, follow', lang })
  return (
    <>
      <LanguageSwitch />
      <main className="not-found">
        <p className="kicker">404</p>
        <h1>{t.notFoundTitle}</h1>
        <p>{t.notFoundBody}</p>
        <Link className="book-link" to={lang === 'en' ? '/?lang=en' : '/'}>
          {t.backHome}
        </Link>
      </main>
    </>
  )
}
