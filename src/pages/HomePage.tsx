import { useState } from 'react'
import { About } from '../components/About'
import { BookingForm } from '../components/BookingForm'
import { Faq } from '../components/Faq'
import { Footer } from '../components/Footer'
import { Hero } from '../components/Hero'
import { LanguageSwitch } from '../components/LanguageSwitch'
import { Services } from '../components/Services'
import { RopeDivider, type RopeEdge } from '../components/RopeDivider'
import { Splash } from '../components/Splash'
import { useLang } from '../language'
import { useHeadTags } from '../seo'

const BOOKING_CUT: RopeEdge = { of: 'prev', left: 1, right: 0.88 }
const FOOTER_CUT: RopeEdge = { of: 'next', left: 0.18, right: 0 }

export function HomePage() {
  const { t, lang } = useLang()
  const [ready, setReady] = useState(false)
  useHeadTags({ title: t.seoTitle, description: t.seoDescription, lang })
  return (
    <>
      {!ready && <Splash onDone={() => setReady(true)} />}
      <LanguageSwitch hidden={!ready} />
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
