import type { ServiceId } from '../../content'
import { completeService, SEED_SERVICES, serviceLabel, sortServices } from '../../service-catalog'
import { MAIL_KEYS, MAIL_LABEL, MAIL_TEMPLATES } from '../../mail-templates'
import type { ServiceSave, TemplateKey, TemplateLang, TemplateSave } from '../../planning-api'

export const SERVICE_SEED: ServiceSave[] = SEED_SERVICES

export const TEMPLATE_KEYS: TemplateKey[] = MAIL_KEYS
export const TEMPLATE_LABEL: Record<TemplateKey, string> = MAIL_LABEL

export const TEMPLATE_SEED: TemplateSave[] = MAIL_KEYS.flatMap((key) =>
  (['nl', 'en'] as const).map((lang) => ({ key, lang, ...MAIL_TEMPLATES[key][lang] })),
)

export const TEMPLATE_LANGS: TemplateLang[] = ['nl', 'en']

export function serviceName(id: ServiceId): string {
  return serviceLabel(id, 'nl')
}

/** The stored services in their order; the built-in three when nothing is stored yet. */
export function withServiceDefaults(rows: ServiceSave[]): ServiceSave[] {
  if (rows.length === 0) return SERVICE_SEED
  return sortServices(rows.map(completeService))
}

export function withTemplateDefaults(rows: TemplateSave[]): TemplateSave[] {
  return TEMPLATE_KEYS.flatMap((key) =>
    TEMPLATE_LANGS.map((lang) => {
      const found = rows.find((row) => row.key === key && row.lang === lang)
      const seed = TEMPLATE_SEED.find((row) => row.key === key && row.lang === lang)
      return found ?? seed!
    }),
  )
}
