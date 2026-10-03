import { copy, type ServiceId } from '../../content'
import type { InboxRow, ServiceSave, TemplateKey, TemplateLang, TemplateSave } from '../../planning-api'

export const DEMO_INBOX: InboxRow[] = [
  {
    id: 'demo-jan',
    service: 'cut',
    name: 'Jan de Vries',
    email: 'jan@example.com',
    phone: '06 12345678',
    start: '2026-10-05T10:00:00',
    kind: 'slot',
    status: 'confirmed',
    mail_sent: true,
  },
  {
    id: 'demo-sara',
    service: 'both',
    name: 'Sara Meijer',
    email: 'sara@example.com',
    phone: '06 87654321',
    start: '2026-10-06T14:00:00',
    kind: 'slot',
    status: 'confirmed',
    mail_sent: true,
  },
  {
    id: 'demo-omar',
    service: 'beard',
    name: 'Omar Hassan',
    email: 'omar@example.com',
    phone: '',
    start: '2026-10-07T09:00:00',
    kind: 'slot',
    status: 'confirmed',
    mail_sent: true,
  },
  {
    id: 'demo-lisa',
    service: 'cut',
    name: 'Lisa Bakker',
    email: 'lisa@example.com',
    phone: '06 11223344',
    start: '2026-10-08T11:30:00',
    kind: 'slot',
    status: 'confirmed',
    mail_sent: true,
  },
  {
    id: 'demo-thomas',
    service: 'cut',
    name: 'Thomas Visser',
    email: 'thomas@example.com',
    phone: '06 33445566',
    start: '2026-10-09T16:00:00',
    kind: 'slot',
    status: 'confirmed',
    mail_sent: true,
  },
  {
    id: 'demo-tom',
    service: 'cut',
    name: 'Tom Peeters',
    email: 'tom@example.com',
    phone: '06 55667788',
    start: '2026-10-09T13:00:00',
    kind: 'custom',
    status: 'pending',
    mail_sent: false,
  },
]

export const SERVICE_SEED: ServiceSave[] = [
  { id: 'cut', price: '€30', minutes: 45 },
  { id: 'beard', price: '€15', minutes: 20 },
  { id: 'both', price: '€40', minutes: 60 },
]

export const TEMPLATE_SEED: TemplateSave[] = [
  {
    key: 'thanks',
    lang: 'nl',
    subject: 'Afspraak BarberBjorn',
    body: 'Hoi {{name}}, je {{service}} staat op {{date}} om {{time}}. Tot dan. Bjorn',
  },
  {
    key: 'thanks',
    lang: 'en',
    subject: 'Appointment BarberBjorn',
    body: 'Hi {{name}}, your {{service}} is on {{date}} at {{time}}. See you then. Bjorn',
  },
  {
    key: 'accepted',
    lang: 'nl',
    subject: 'Afspraak bevestigd',
    body: 'Hoi {{name}}, je {{service}} op {{date}} om {{time}} is bevestigd. Bjorn',
  },
  {
    key: 'accepted',
    lang: 'en',
    subject: 'Appointment confirmed',
    body: 'Hi {{name}}, your {{service}} on {{date}} at {{time}} is confirmed. Bjorn',
  },
  {
    key: 'declined',
    lang: 'nl',
    subject: 'Afspraak niet mogelijk',
    body: 'Hoi {{name}}, {{date}} om {{time}} lukt niet. Mail of bel voor een andere tijd. Bjorn',
  },
  {
    key: 'declined',
    lang: 'en',
    subject: 'Could not book that time',
    body: 'Hi {{name}}, {{date}} at {{time}} is not possible. Mail or call for another time. Bjorn',
  },
]

export const TEMPLATE_LABEL: Record<TemplateKey, string> = {
  thanks: 'Bedankt',
  accepted: 'Bevestigd',
  declined: 'Geweigerd',
}

export const TEMPLATE_KEYS: TemplateKey[] = ['thanks', 'accepted', 'declined']
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
