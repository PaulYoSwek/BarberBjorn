import { Link } from 'react-router-dom'
import { Footer } from '../components/Footer'
import { LanguageSwitch } from '../components/LanguageSwitch'
import { useLang } from '../language'
import { PRIVACY } from '../privacy'
import { useHeadTags } from '../seo'

export function PrivacyPage() {
  const { lang, t } = useLang()
  const text = PRIVACY[lang]
  useHeadTags({
    title: `${text.title} · Bjorn’s Barber`,
    description: text.intro,
    lang,
    path: '/privacy',
  })
  return (
    <>
      <LanguageSwitch />
      <main className="privacy">
        <article className="privacy-body">
          <Link className="privacy-back" to={lang === 'en' ? '/?lang=en' : '/'}>
            ← {t.backHome}
          </Link>
          <p className="kicker">Bjorn’s Barber</p>
          <h1>{text.title}</h1>
          <p className="privacy-updated">{text.updated}</p>
          <p className="privacy-intro">{text.intro}</p>
          <nav className="privacy-toc" aria-label={lang === 'en' ? 'Contents' : 'Inhoud'}>
            <ol>
              {text.sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>{section.heading}</a>
                </li>
              ))}
            </ol>
          </nav>
          {text.sections.map((section) => (
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`}>
              <h2 id={`${section.id}-title`}>{section.heading}</h2>
              {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.list ? (
                <ul>
                  {section.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
              {section.after?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </section>
          ))}
        </article>
      </main>
      <Footer />
    </>
  )
}
