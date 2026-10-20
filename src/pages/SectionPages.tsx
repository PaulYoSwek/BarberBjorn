import type { ReactNode } from 'react'
import { About } from '../components/About'
import { BookingForm } from '../components/BookingForm'
import { Contact } from '../components/Contact'
import { Faq } from '../components/Faq'
import { Footer } from '../components/Footer'
import { Services } from '../components/Services'
import { SECTION_PATHS, SiteHeader } from '../components/SiteHeader'
import type { Copy } from '../content'
import { useLang } from '../language'
import { useHeadTags } from '../seo'

type PageKey = keyof Copy['pages']

/**
 * One section of the home page on its own address, with a title of its own.
 * The home page still shows them all; these exist for sharing and for search.
 */
function SectionPage({ page, path, children }: { page: PageKey; path: string; children: ReactNode }) {
  const { t, lang } = useLang()
  const copy = t.pages[page]
  useHeadTags({ title: `${copy.title} · Bjorn’s Barber`, description: copy.description, lang, path })
  return (
    <>
      <SiteHeader />
      <main className="section-page">
        <header className="page-head">
          <p className="kicker">Bjorn’s Barber</p>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </header>
        {children}
      </main>
      <Footer />
    </>
  )
}

export function BookPage() {
  return (
    <SectionPage page="book" path={SECTION_PATHS.book}>
      <BookingForm />
    </SectionPage>
  )
}

export function ServicesPage() {
  return (
    <SectionPage page="services" path={SECTION_PATHS.services}>
      <Services />
    </SectionPage>
  )
}

export function AboutPage() {
  return (
    <SectionPage page="about" path={SECTION_PATHS.about}>
      <About />
    </SectionPage>
  )
}

export function FaqPage() {
  return (
    <SectionPage page="faq" path={SECTION_PATHS.faq}>
      <Faq />
    </SectionPage>
  )
}

export function ContactPage() {
  return (
    <SectionPage page="contact" path={SECTION_PATHS.contact}>
      <Contact />
    </SectionPage>
  )
}
