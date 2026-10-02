import { useLang } from '../language'

export function About() {
  const { t } = useLang()
  return (
    <section className="about">
      <img src="/portrait.png" alt="Bjorn" />
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
