import { useState } from 'react'
import { useLang } from '../language'

export function Hero() {
  const { t } = useLang()
  const [videoOn, setVideoOn] = useState(true)

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
      <div className="hero-copy">
        <img src="/logo-wordmark.png" alt="BarberBjorn" />
        <p>{t.tagline}</p>
        <a className="book-link" href="#afspraak">{t.bookCta}</a>
      </div>
      <div className="hero-map" data-testid="map-slot" />
    </header>
  )
}
