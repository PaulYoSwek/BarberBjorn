import { useEffect, useState } from 'react'
import { About } from '../components/About'
import { BookingForm } from '../components/BookingForm'
import { Faq } from '../components/Faq'
import { Footer } from '../components/Footer'
import { Hero } from '../components/Hero'
import { SiteHeader } from '../components/SiteHeader'
import { Services } from '../components/Services'
import { RopeDivider, type RopeEdge } from '../components/RopeDivider'
import { Splash } from '../components/Splash'
import { useLang } from '../language'
import { useHeadTags } from '../seo'

const SPLASH_SEEN = 'barber-splash-seen'

function splashSeen(): boolean {
  try {
    return sessionStorage.getItem(SPLASH_SEEN) === '1'
  } catch {
    return false
  }
}

function rememberSplash() {
  try {
    sessionStorage.setItem(SPLASH_SEEN, '1')
  } catch {
    /* private mode: the intro simply plays again */
  }
}

const BOOKING_CUT: RopeEdge = { of: 'prev', left: 1, right: 0.88 }
const FOOTER_CUT: RopeEdge = { of: 'next', left: 0.18, right: 0 }

export function HomePage() {
  const { t, lang } = useLang()
  // The intro plays once per visit, not again on every page you come back to.
  const [ready, setReady] = useState(splashSeen)
  useHeadTags({ title: t.seoTitle, description: t.seoDescription, lang })

  // The page is built by script, so the browser cannot scroll to #afspraak on its
  // own. Jump there at once (a smooth scroll this early gets cancelled while the
  // page is still loading) and once more when loading is done, in case it shifted.
  useEffect(() => {
    if (!ready) return
    const id = decodeURIComponent(window.location.hash.slice(1))
    if (!id) return
    const go = () => document.getElementById(id)?.scrollIntoView?.({ behavior: 'instant' })
    const timer = window.setTimeout(go, 0)
    if (document.readyState !== 'complete') window.addEventListener('load', go, { once: true })
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('load', go)
    }
  }, [ready])

  return (
    <>
      {!ready && (
        <Splash
          onDone={() => {
            rememberSplash()
            setReady(true)
          }}
        />
      )}
      <SiteHeader />
      <main>
        <Hero />
        <BookingForm />
        <RopeDivider tone="paper" edge={BOOKING_CUT} />
        <Services />
        <RopeDivider tone="warm" />
        <About />
        <RopeDivider tone="about" />
        <Faq />
        <RopeDivider tone="paper" edge={FOOTER_CUT} />
        <Footer />
      </main>
    </>
  )
}
