import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { CONTACT } from '../content'
import { prefersStills, whenIdle } from '../idle'
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
  // The video (2 MB; 200 KB on phones) starts only once everything else is in.
  const [videoSrc, setVideoSrc] = useState('')
  const seamWrap = useRef<HTMLDivElement>(null)
  const [seam, setSeam] = useState<CSSProperties>({})

  useEffect(() => {
    if (prefersStills()) {
      setVideoOn(false)
      return
    }
    const small = window.matchMedia('(max-width: 800px)').matches
    return whenIdle(() => setVideoSrc(small ? '/hero-mobile.mp4' : '/hero.mp4'))
  }, [])

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
          src={videoSrc || undefined}
          preload="none"
          poster="/hero-poster.jpg"
          muted
          loop
          playsInline
          autoPlay
          disablePictureInPicture
          aria-hidden="true"
          tabIndex={-1}
          onError={() => setVideoOn(false)}
          onLoadedData={(event) => {
            // Belt and braces: autoplay applies to a source set after mount, but ask once anyway.
            const playing = event.currentTarget.play?.()
            if (playing && typeof playing.catch === 'function') playing.catch(() => {})
          }}
        />
      )}
      <div className="hero-scrim" />
      <picture>
        <source srcSet="/logo-mark-small.webp?v=4" type="image/webp" />
        <img className="hero-stamp" src="/logo-mark-small.png?v=4" alt="" width="68" height="68" decoding="async" />
      </picture>
      <div className="hero-copy">
        <h1 className="hero-title">
          <picture>
            <source srcSet="/logo-name.webp?v=4" type="image/webp" />
            <img className="hero-name" src="/logo-name.png?v=3" alt="Bjorn’s Barber" width="460" height="200" fetchPriority="high" />
          </picture>
          <span className="sr-only">{t.heroHidden}</span>
        </h1>
        <p>{t.tagline}</p>
        <a className="book-link" href="#afspraak">{t.bookCta}</a>
      </div>
      <div className="hero-map-wrap" ref={seamWrap}>
        <img className="hero-seam" src="/rope-seam.png?v=13" alt="" style={seam} decoding="async" />
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
