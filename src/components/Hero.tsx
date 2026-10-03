import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { CONTACT } from '../content'
import { useLang } from '../language'
import { mapsDirectionsUrl } from '../pin'
import { MapPanel } from './MapPanel'

function seamStyle(el: HTMLElement, narrow: boolean): CSSProperties {
  if (narrow) return { top: 0, left: 0, width: '100%', transform: 'translateY(-50%)' }
  const w = el.clientWidth
  const h = el.clientHeight
  const x1 = w * 0.16
  const len = Math.hypot(x1, h)
  const angle = Math.atan2(h, -x1) * (180 / Math.PI)
  return {
    left: x1 / 2,
    top: h / 2,
    width: len,
    transform: `translate(-50%, -50%) rotate(${angle}deg)`,
  }
}

export function Hero() {
  const { t } = useLang()
  const [videoOn, setVideoOn] = useState(true)
  const seamWrap = useRef<HTMLDivElement>(null)
  const [seam, setSeam] = useState<CSSProperties>({})

  useEffect(() => {
    const el = seamWrap.current
    if (!el) return
    const fit = () => {
      setSeam(seamStyle(el, window.innerWidth <= 800))
    }
    fit()
    if (typeof ResizeObserver === 'undefined') return
    const watch = new ResizeObserver(fit)
    watch.observe(el)
    return () => watch.disconnect()
  }, [])

  return (
    <header className="hero">
      {videoOn && (
        <video
          className="hero-video"
          src="/hero.mp4"
          muted
          loop
          playsInline
          autoPlay
          onError={() => setVideoOn(false)}
        />
      )}
      <div className="hero-scrim" />
      <img className="hero-stamp" src="/logo-mark.png?v=2" alt="" />
      <div className="hero-copy">
        <img className="hero-name" src="/logo-name.png?v=2" alt="BarberBjorn" />
        <p>{t.tagline}</p>
        <a className="book-link" href="#afspraak">{t.bookCta}</a>
      </div>
      <div className="hero-map-wrap" ref={seamWrap}>
        <img className="hero-seam" src="/rope-seam.png?v=13" alt="" style={seam} />
        <div className="hero-map">
          <MapPanel />
          <p className="map-address">
            {CONTACT.addressFull.split(', ').map((line) => (
              <span key={line}>{line}</span>
            ))}
          </p>
          <a
            className="map-directions"
            href={mapsDirectionsUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.directionsCta}
          </a>
        </div>
      </div>
    </header>
  )
}
