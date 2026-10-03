import { copy, type Lang, type ServiceId } from '../../../src/content.ts'
import { fillTemplate } from '../../../src/planning.ts'
import type { Db } from './db.ts'
import { sendResend } from './resend.ts'
import { utcToSalonWall } from './salon.ts'

export type MailKey = 'thanks' | 'accepted' | 'declined'

const FALLBACK: Record<MailKey, Record<Lang, { subject: string; body: string }>> = {
  thanks: {
    nl: {
      subject: 'Afspraak BarberBjorn',
      body: 'Hoi {{name}}, je {{service}} staat op {{date}} om {{time}}. Tot dan. Bjorn',
    },
    en: {
      subject: 'Appointment BarberBjorn',
      body: 'Hi {{name}}, your {{service}} is on {{date}} at {{time}}. See you then. Bjorn',
    },
  },
  accepted: {
    nl: {
      subject: 'Afspraak bevestigd',
      body: 'Hoi {{name}}, je {{service}} op {{date}} om {{time}} is bevestigd. Bjorn',
    },
    en: {
      subject: 'Appointment confirmed',
      body: 'Hi {{name}}, your {{service}} on {{date}} at {{time}} is confirmed. Bjorn',
    },
  },
  declined: {
    nl: {
      subject: 'Afspraak niet mogelijk',
      body: 'Hoi {{name}}, {{date}} om {{time}} lukt niet. Mail of bel voor een andere tijd. Bjorn',
    },
    en: {
      subject: 'Could not book that time',
      body: 'Hi {{name}}, {{date}} at {{time}} is not possible. Mail or call for another time. Bjorn',
    },
  },
}

type MailBooking = {
  id: string
  email: string
  name: string
  service: string
  start: string
  lang: string
}

function isLang(value: string): value is Lang {
  return value === 'nl' || value === 'en'
}

function serviceName(lang: Lang, service: string): string {
  const found = copy[lang].services.find((item) => item.id === service)
  return found?.name ?? service
}

export async function sendBookingMail(
  db: Db,
  booking: MailBooking,
  key: MailKey,
  draft?: { subject?: string; body?: string },
): Promise<{ sent: boolean }> {
  const lang: Lang = isLang(booking.lang) ? booking.lang : 'nl'
  let subject = draft?.subject?.trim() ?? ''
  let text = draft?.body?.trim() ?? ''
  if (!subject || !text) {
    const { data } = await db
      .from('mail_templates')
      .select('subject, body')
      .eq('key', key)
      .eq('lang', lang)
      .maybeSingle()
    const stored = data as { subject?: string; body?: string } | null
    const fallback = FALLBACK[key][lang]
    const wall = utcToSalonWall(String(booking.start))
    const vars = {
      name: booking.name,
      service: serviceName(lang, booking.service as ServiceId),
      date: wall.slice(0, 10),
      time: wall.slice(11, 16),
    }
    if (!subject) subject = fillTemplate(stored?.subject || fallback.subject, vars)
    if (!text) text = fillTemplate(stored?.body || fallback.body, vars)
  }
  const result = await sendResend(booking.email, subject, text)
  const updated = await db.from('bookings').update({ mail_sent: result.sent }).eq('id', booking.id)
  if (updated.error) console.error(updated.error.message)
  return result
}
