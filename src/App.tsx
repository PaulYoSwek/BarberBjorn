import { useState } from 'react'
import { About } from './components/About'
import { BookingForm } from './components/BookingForm'
import { Faq } from './components/Faq'
import { Footer } from './components/Footer'
import { Hero } from './components/Hero'
import { Hours } from './components/Hours'
import { LanguageSwitch } from './components/LanguageSwitch'
import { Services } from './components/Services'
import { Splash } from './components/Splash'
import { LanguageProvider } from './language'

export default function App() {
  const [ready, setReady] = useState(false)
  return (
    <LanguageProvider>
      {!ready && <Splash onDone={() => setReady(true)} />}
      <LanguageSwitch hidden={!ready} />
      <main>
        <Hero />
        <BookingForm />
        <Services />
        <Hours />
        <About />
        <Faq />
        <Footer />
      </main>
    </LanguageProvider>
  )
}
