import { Route, Routes } from 'react-router-dom'
import { LanguageProvider } from './language'
import { AdminPage } from './pages/AdminPage'
import { HomePage } from './pages/HomePage'

export default function App() {
  return (
    <LanguageProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </LanguageProvider>
  )
}
