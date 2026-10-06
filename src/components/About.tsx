import { useLang } from '../language'

export function About() {
  const { t } = useLang()
  return (
    <section className="about">
      <picture>
        <source srcSet="/portrait.webp" type="image/webp" />
        <img src="/portrait.png" alt={t.portraitAlt} width="861" height="1024" loading="lazy" decoding="async" />
      </picture>
      <div className="about-shard">
        <p className="kicker">{t.aboutKicker}</p>
        <h2>{t.aboutTitle}</h2>
        {t.aboutLines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </section>
  )
}
