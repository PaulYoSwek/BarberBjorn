import { useEffect, useState } from 'react'
import { euroLabel } from '../clients'
import { useLang } from '../language'
import { loadServices } from '../planning-api'
import { setOfferPrices } from '../seo'
import { completeService, offered, SEED_SERVICES, setServiceCatalog, type ServiceInfo } from '../service-catalog'

/** The first three are the big plates; anything Bjorn adds after that is listed below them. */
const PLATES = 3

export function Services() {
  const { t, lang } = useLang()
  const [services, setServices] = useState<ServiceInfo[]>(SEED_SERVICES)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadServices()
      .then((rows) => {
        if (cancelled || rows.length === 0) return
        setServiceCatalog(rows)
        setServices(rows.map(completeService))
        setOfferPrices(offered(rows.map(completeService)))
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const list = offered(services)
  const plates = list.slice(0, PLATES)
  const more = list.slice(PLATES)

  return (
    <section className="services">
      <h2 className="kicker">{t.servicesKicker}</h2>
      <div className={`plates${loaded ? '' : ' is-loading'}`}>
        {plates.map((item, index) => (
          <article key={item.id} className={index === plates.length - 1 && plates.length === PLATES ? 'is-both' : undefined}>
            <strong>{euroLabel(item.price)}</strong>
            <h3>{item.name[lang]}</h3>
            {item.detail[lang] ? <p>{item.detail[lang]}</p> : null}
          </article>
        ))}
      </div>
      {more.length > 0 ? (
        <ul className="services-more">
          {more.map((item) => (
            <li key={item.id}>
              <div>
                <h3>{item.name[lang]}</h3>
                {item.detail[lang] ? <p>{item.detail[lang]}</p> : null}
              </div>
              <strong>{euroLabel(item.price)}</strong>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
