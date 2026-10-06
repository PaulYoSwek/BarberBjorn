import { copy, type ServiceId } from '../../content'
import { MAIL_KEYS, MAIL_LABEL, MAIL_TEMPLATES } from '../../mail-templates'
import type { ServiceSave, TemplateKey, TemplateLang, TemplateSave } from '../../planning-api'

export const SERVICE_SEED: ServiceSave[] = [
  { id: 'cut', price: '€30', minutes: 45 },
  { id: 'beard', price: '€15', minutes: 30 },
  { id: 'both', price: '€40', minutes: 75 },
]

export const TEMPLATE_KEYS: TemplateKey[] = MAIL_KEYS
export const TEMPLATE_LABEL: Record<TemplateKey, string> = MAIL_LABEL

export const TEMPLATE_SEED: TemplateSave[] = MAIL_KEYS.flatMap((key) =>
  (['nl', 'en'] as const).map((lang) => ({ key, lang, ...MAIL_TEMPLATES[key][lang] })),
)

export const TEMPLATE_LANGS: TemplateLang[] = ['nl', 'en']

export function serviceName(id: ServiceId): string {
  return copy.nl.services.find((item) => item.id === id)?.name ?? id
}

export function withServiceDefaults(rows: ServiceSave[]): ServiceSave[] {
  return SERVICE_SEED.map((seed) => rows.find((row) => row.id === seed.id) ?? seed)
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
