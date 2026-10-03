import type { Copy, ServiceId } from './content'
import { agendaDays } from './schedule'

export type BookingKind = 'slot' | 'custom'

export type BookingInput = {
  service: ServiceId | ''
  name: string
  email: string
  phone: string
  slot: string
  kind: BookingKind
}

export type Field = 'service' | 'name' | 'email' | 'phone' | 'slot'

export type BookingResult =
  | { ok: true; subject: string; body: string }
  | { ok: false; errors: Partial<Record<Field, string>> }

function isService(value: string): value is ServiceId {
  return value === 'cut' || value === 'beard' || value === 'both'
}

const SLOT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/

export function validateBooking(input: BookingInput, t: Copy, todayIso: string): BookingResult {
  const errors: Partial<Record<Field, string>> = {}
  if (!isService(input.service)) errors.service = t.fieldError
  if (input.name.trim().length < 2) errors.name = t.fieldError
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) errors.email = t.fieldError

  if (!SLOT.test(input.slot)) {
    errors.slot = t.fieldError
  } else {
    const date = input.slot.slice(0, 10)
    if (date < todayIso) {
      errors.slot = t.pastError
    } else if (input.kind === 'slot' && isService(input.service)) {
      const day = agendaDays(input.service, new Date(`${todayIso}T00:00:00`)).find((item) => item.date === date)
      const found = day?.slots.find((item) => item.start === input.slot)
      if (!day || day.closed) errors.slot = t.weekendError
      else if (!found) errors.slot = t.fieldError
      else if (found.taken) errors.slot = t.takenError
      else if (found.past) errors.slot = t.pastError
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  const serviceName = t.services.find((item) => item.id === input.service)?.name ?? ''
  const lines = [
    `${t.serviceLabel}: ${serviceName}`,
    `${t.nameLabel}: ${input.name.trim()}`,
    `${t.emailLabel}: ${input.email.trim()}`,
  ]
  if (input.phone.trim()) lines.push(`${t.phoneLabel}: ${input.phone.trim()}`)
  lines.push(`${t.slotLabel}: ${input.slot.slice(0, 10)} ${input.slot.slice(11, 16)}`, '', t.requestNote)
  const body = lines.join('\n')
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
