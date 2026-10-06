import { useEffect, useState } from 'react'
import type { ServiceId } from '../content'
import { useLang } from '../language'
import { loadServices } from '../planning-api'

export function Services() {
  const { t } = useLang()
  const [prices, setPrices] = useState<Partial<Record<ServiceId, string>> | null>(null)

  useEffect(() => {
    let cancelled = false
    loadServices()
      .then((rows) => {
        if (cancelled || rows.length === 0) return
        const next: Partial<Record<ServiceId, string>> = {}
        for (const row of rows) next[row.id] = row.price
        setPrices(next)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="services">
      <h2 className="kicker">{t.servicesKicker}</h2>
      <div className="plates">
        {t.services.map((item) => (
          <article key={item.id} className={item.id === 'both' ? 'is-both' : undefined}>
            <strong>{prices?.[item.id] ?? item.price}</strong>
            <h3>{item.name}</h3>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
