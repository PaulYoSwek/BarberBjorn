import { useLang } from '../language'

export function Services() {
  const { t } = useLang()
  return (
    <section className="services">
      <p className="kicker">{t.servicesKicker}</p>
      <div className="plates">
        {t.services.map((item) => (
          <article key={item.id} className={item.id === 'both' ? 'is-both' : undefined}>
            <strong>{item.price}</strong>
            <h3>{item.name}</h3>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
