import { useEffect } from 'react'
import { SITE_URL, type Lang } from './content'
import type { DayHours, Weekday } from './schedule'

type HeadTags = {
  title: string
  description?: string
  robots?: string
  lang?: Lang
  /** Path for canonical and social links. Defaults to the front page. */
  path?: string
}

function setMeta(selector: string, attribute: 'name' | 'property', key: string, content: string) {
  let node = document.head.querySelector<HTMLMetaElement>(selector)
  if (!node) {
    node = document.createElement('meta')
    node.setAttribute(attribute, key)
    document.head.appendChild(node)
  }
  node.setAttribute('content', content)
}

function setLink(rel: string, href: string, hreflang?: string) {
  const selector = hreflang ? `link[rel="${rel}"][hreflang="${hreflang}"]` : `link[rel="${rel}"]`
  let node = document.head.querySelector<HTMLLinkElement>(selector)
  if (!node) {
    node = document.createElement('link')
    node.setAttribute('rel', rel)
    if (hreflang) node.setAttribute('hreflang', hreflang)
    document.head.appendChild(node)
  }
  node.setAttribute('href', href)
}

const DAY_NAMES: Record<Weekday, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
}

/** Rewrites the opening hours in the structured data to match the live week. */
export function setOpeningHours(week: Record<Weekday, DayHours>) {
  const script = document.getElementById('ld-business')
  if (!script) return
  try {
    const data = JSON.parse(script.textContent || '{}') as Record<string, unknown>
    const groups = new Map<string, string[]>()
    for (const key of Object.keys(DAY_NAMES) as Weekday[]) {
      const hours = week[key]
      if (!hours || 'closed' in hours) continue
      const span = `${hours.open}-${hours.close}`
      groups.set(span, [...(groups.get(span) ?? []), DAY_NAMES[key]])
    }
    data.openingHoursSpecification = [...groups.entries()].map(([span, days]) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: days,
      opens: span.split('-')[0],
      closes: span.split('-')[1],
    }))
    script.textContent = JSON.stringify(data)
  } catch {
    /* leave the static hours in place */
  }
}

/**
 * Keeps the document head in step with the page and language. Crawlers that
 * run JavaScript see the translated title and description; the static tags in
 * index.html cover the Dutch default for everyone else.
 */
export function useHeadTags({ title, description, robots, lang, path = '/' }: HeadTags) {
  useEffect(() => {
    document.title = title
    if (description) {
      setMeta('meta[name="description"]', 'name', 'description', description)
      setMeta('meta[property="og:description"]', 'property', 'og:description', description)
      setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description)
    }
    setMeta('meta[property="og:title"]', 'property', 'og:title', title)
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title)
    setMeta('meta[name="robots"]', 'name', 'robots', robots ?? 'index, follow')
    if (lang) {
      setMeta('meta[property="og:locale"]', 'property', 'og:locale', lang === 'en' ? 'en_GB' : 'nl_NL')
      const canonical = lang === 'en' ? `${SITE_URL}${path}?lang=en` : `${SITE_URL}${path}`
      setLink('canonical', canonical)
      setMeta('meta[property="og:url"]', 'property', 'og:url', canonical)
    }
  }, [title, description, robots, lang, path])
}
