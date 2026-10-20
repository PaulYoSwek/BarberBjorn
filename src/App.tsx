import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { LanguageProvider } from './language'
import { HomePage } from './pages/HomePage'

const RELOADED = 'barber-chunk-reload'

/**
 * A tab left open across a deploy asks for code chunks by names that no longer
 * exist. Instead of a blank tab, load the page fresh once; a second failure is
 * reported as usual so a real outage is not hidden behind endless reloads.
 */
export async function loadChunk<T>(load: () => Promise<T>): Promise<T> {
  try {
    const module = await load()
    try {
      sessionStorage.removeItem(RELOADED)
    } catch {
      /* storage blocked */
    }
    return module
  } catch (error) {
    let reloaded = false
    try {
      reloaded = sessionStorage.getItem(RELOADED) === '1'
      if (!reloaded) sessionStorage.setItem(RELOADED, '1')
    } catch {
      /* storage blocked: reload once anyway */
    }
    if (!reloaded) {
      window.location.reload()
      return new Promise<T>(() => {})
    }
    throw error
  }
}

// Visitors never need the dashboard code, so it ships as its own chunk.
const AdminPage = lazy(() => loadChunk(() => import('./pages/AdminPage')).then((module) => ({ default: module.AdminPage })))
const PrivacyPage = lazy(() => loadChunk(() => import('./pages/PrivacyPage')).then((module) => ({ default: module.PrivacyPage })))
const NotFoundPage = lazy(() => loadChunk(() => import('./pages/NotFoundPage')).then((module) => ({ default: module.NotFoundPage })))
// Every section of the home page also has its own address; they share one chunk.
const sections = () => loadChunk(() => import('./pages/SectionPages'))
const BookPage = lazy(() => sections().then((module) => ({ default: module.BookPage })))
const ServicesPage = lazy(() => sections().then((module) => ({ default: module.ServicesPage })))
const AboutPage = lazy(() => sections().then((module) => ({ default: module.AboutPage })))
const FaqPage = lazy(() => sections().then((module) => ({ default: module.FaqPage })))
const ContactPage = lazy(() => sections().then((module) => ({ default: module.ContactPage })))

export default function App() {
  return (
    <LanguageProvider>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/afspraak" element={<BookPage />} />
          <Route path="/diensten" element={<ServicesPage />} />
          <Route path="/over-bjorn" element={<AboutPage />} />
          <Route path="/vragen" element={<FaqPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </LanguageProvider>
  )
}
