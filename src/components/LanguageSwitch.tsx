import { useLang } from '../language'
import type { Lang } from '../content'

export function LanguageSwitch({ hidden = false }: { hidden?: boolean }) {
  const { lang, setLang } = useLang()
  if (hidden) return null
  const button = (code: Lang) => (
    <button
      type="button"
      className={lang === code ? 'is-on' : undefined}
      aria-pressed={lang === code}
      onClick={() => setLang(code)}
    >
      {code.toUpperCase()}
    </button>
  )
  return (
    <div className="lang-switch">
      {button('nl')}
      {button('en')}
    </div>
  )
}
