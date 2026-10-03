import type { BookingInput } from '../../../src/booking.ts'
import { copy, type Lang } from '../../../src/content.ts'

export type BookingBody = BookingInput & { lang: Lang }

function isService(value: unknown): value is BookingInput['service'] {
  return value === 'cut' || value === 'beard' || value === 'both' || value === ''
}

export function parseBooking(value: unknown, kind: BookingInput['kind']): BookingBody | null {
  if (!value || typeof value !== 'object') return null
  const body = value as Record<string, unknown>
  const lang = body.lang === 'en' ? 'en' : body.lang === 'nl' ? 'nl' : null
  if (!lang) return null
  const service = isService(body.service) ? body.service : ''
  return {
    service,
    name: typeof body.name === 'string' ? body.name : '',
    email: typeof body.email === 'string' ? body.email : '',
    phone: typeof body.phone === 'string' ? body.phone : '',
    slot: typeof body.slot === 'string' ? body.slot : '',
    kind,
    lang,
  }
}

export function takenMessage(lang: Lang): string {
  return copy[lang].takenError
}

export function validationMessage(
  errors: Partial<Record<'service' | 'name' | 'email' | 'phone' | 'slot', string>>,
  lang: Lang,
): string {
  return errors.slot || errors.email || errors.name || errors.service || errors.phone || copy[lang].fieldError
}
