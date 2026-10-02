import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { copy, type Copy, type Lang } from './content'

const STORAGE_KEY = 'barber-lang'

export function readInitialLang(search: string, stored: string | null): Lang {
  const query = new URLSearchParams(search).get('lang')
  if (query === 'nl' || query === 'en') return query
  if (stored === 'nl' || stored === 'en') return stored
  return 'nl'
}

type LanguageValue = { lang: Lang; setLang: (lang: Lang) => void; t: Copy }

const LanguageContext = createContext<LanguageValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() =>
    readInitialLang(window.location.search, localStorage.getItem(STORAGE_KEY)),
  )

  const setLang = (next: Lang) => {
    setLangState(next)
    localStorage.setItem(STORAGE_KEY, next)
    const url = new URL(window.location.href)
    url.searchParams.set('lang', next)
    window.history.replaceState(null, '', url)
    document.documentElement.lang = next
  }

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const value = useMemo(() => ({ lang, setLang, t: copy[lang] }), [lang])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLang(): LanguageValue {
  const value = useContext(LanguageContext)
  if (!value) throw new Error('useLang must be used inside LanguageProvider')
  return value
}
