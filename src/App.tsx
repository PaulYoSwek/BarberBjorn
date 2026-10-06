import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { LanguageProvider } from './language'
import { HomePage } from './pages/HomePage'

// Visitors never need the dashboard code, so it ships as its own chunk.
const AdminPage = lazy(() => import('./pages/AdminPage').then((module) => ({ default: module.AdminPage })))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage').then((module) => ({ default: module.PrivacyPage })))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })))

export default function App() {
  return (
    <LanguageProvider>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </LanguageProvider>
  )
}
