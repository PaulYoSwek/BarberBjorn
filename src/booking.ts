import type { Copy, ServiceId } from './content'

export type BookingInput = {
  service: ServiceId | ''
  name: string
  phone: string
  day: string
}

type Field = 'service' | 'name' | 'phone' | 'day'

export type BookingResult =
  | { ok: true; subject: string; body: string }
  | { ok: false; errors: Partial<Record<Field, string>> }

function isService(value: string): value is ServiceId {
  return value === 'cut' || value === 'beard' || value === 'both'
}

export function validateBooking(input: BookingInput, t: Copy, todayIso: string): BookingResult {
  const errors: Partial<Record<Field, string>> = {}
  if (!isService(input.service)) errors.service = t.fieldError
  if (input.name.trim().length < 2) errors.name = t.fieldError
  if (input.phone.replace(/\D/g, '').length < 8) errors.phone = t.fieldError

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.day)) {
    errors.day = t.fieldError
  } else if (input.day < todayIso) {
    errors.day = t.pastError
  } else {
    const weekday = new Date(`${input.day}T12:00:00`).getDay()
    if (weekday === 0 || weekday === 6) errors.day = t.weekendError
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  const serviceName = t.services.find((item) => item.id === input.service)?.name ?? ''
  const body = [
    `${t.serviceLabel}: ${serviceName}`,
    `${t.nameLabel}: ${input.name.trim()}`,
    `${t.phoneLabel}: ${input.phone.trim()}`,
    `${t.dayLabel}: ${input.day}`,
    '',
    t.requestNote,
  ].join('\n')
  return { ok: true, subject: t.mailSubject, body }
}

export function mailtoHref(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export function todayIso(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}
