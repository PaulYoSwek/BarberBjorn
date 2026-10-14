import { copy, type Lang, type ServiceId } from './content.ts'
import { DEFAULT_MINUTES, SERVICE_MINUTES } from './schedule.ts'

/** One service as Bjorn sets it up in the dashboard and the site shows it. */
export type ServiceInfo = {
  id: ServiceId
  price: string
  minutes: number
  name: Record<Lang, string>
  detail: Record<Lang, string>
  /** Position on the site, low first. */
  sort: number
  /** Hidden services stay on old bookings but cannot be booked. */
  active: boolean
}

/** Ids are short lowercase slugs, e.g. "kids-knippen". */
export const SERVICE_ID = /^[a-z0-9-]{1,40}$/

export const SEED_SERVICES: ServiceInfo[] = copy.nl.services.map((item, index) => ({
  id: item.id,
  price: item.price,
  minutes: SERVICE_MINUTES[item.id] ?? DEFAULT_MINUTES,
  name: { nl: item.name, en: copy.en.services[index]?.name ?? item.name },
  detail: { nl: item.detail, en: copy.en.services[index]?.detail ?? item.detail },
  sort: index + 1,
  active: true,
}))

/** A service as stored or typed: everything but id, price and length may be missing. */
export type ServiceDraft = Pick<ServiceInfo, 'id' | 'price' | 'minutes'> & {
  name?: { nl?: string; en?: string }
  detail?: { nl?: string; en?: string }
  sort?: number
  active?: boolean
}

/**
 * Fill what a row leaves out: the built-in services take their texts from the
 * site copy, and English falls back to Dutch.
 */
export function completeService(row: ServiceDraft): ServiceInfo {
  const seed = SEED_SERVICES.find((item) => item.id === row.id)
  const nl = row.name?.nl?.trim() || seed?.name.nl || row.id
  const detailNl = row.detail?.nl?.trim() || seed?.detail.nl || ''
  return {
    id: row.id,
    price: row.price,
    minutes: row.minutes,
    name: { nl, en: row.name?.en?.trim() || seed?.name.en || nl },
    detail: { nl: detailNl, en: row.detail?.en?.trim() || seed?.detail.en || detailNl },
    sort: row.sort ?? seed?.sort ?? 99,
    active: row.active ?? true,
  }
}

export function sortServices(list: ServiceInfo[]): ServiceInfo[] {
  return list.slice().sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id))
}

/** What the site offers, in order. */
export function offered(list: ServiceInfo[]): ServiceInfo[] {
  return sortServices(list.filter((item) => item.active))
}

let catalog: ServiceInfo[] = SEED_SERVICES

/** The services last loaded on this page, so names resolve everywhere. */
export function setServiceCatalog(list: ServiceDraft[]) {
  if (list.length > 0) catalog = sortServices(list.map(completeService))
}

export function serviceCatalog(): ServiceInfo[] {
  return catalog
}

export function serviceLabel(id: ServiceId, lang: Lang = 'nl', list: ServiceInfo[] = catalog): string {
  return list.find((item) => item.id === id)?.name[lang] ?? SEED_SERVICES.find((item) => item.id === id)?.name[lang] ?? id
}

/** A readable id from the name, unique among the ones in use. */
export function newServiceId(name: string, taken: string[]): string {
  const base =
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\+/g, ' en ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'dienst'
  let id = base
  for (let count = 2; taken.includes(id); count++) id = `${base}-${count}`
  return id
}
