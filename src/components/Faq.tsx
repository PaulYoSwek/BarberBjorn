import { useLang } from '../language'

export function Faq() {
  const { t } = useLang()
  return (
    <section className="faq">
      {t.faq.map((item, index) => (
        <article key={item.q}>
          <span>{String(index + 1).padStart(2, '0')}</span>
          <div>
            <h3>{item.q}</h3>
            <p>{item.a}</p>
          </div>
        </article>
      ))}
    </section>
  )
}
