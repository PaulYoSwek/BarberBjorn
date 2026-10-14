import { copy, type Lang } from '../../../src/content.ts'
import { humanDate, MAIL_TEMPLATES, type MailKey } from '../../../src/mail-templates.ts'
import { fillTemplate } from '../../../src/planning.ts'
import type { Db } from './db.ts'
import { sendResend } from './resend.ts'
import { utcToSalonWall } from './salon.ts'

export type { MailKey }

const FALLBACK = MAIL_TEMPLATES

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

/** The service as Bjorn named it in the dashboard, else the built-in name. */
async function serviceName(db: Db, lang: Lang, service: string): Promise<string> {
  try {
    const { data } = await db.from('services').select('name_nl, name_en').eq('id', service).maybeSingle()
    const row = data as { name_nl?: string; name_en?: string } | null
    const named = lang === 'en' ? row?.name_en || row?.name_nl : row?.name_nl
    if (named) return named
  } catch {
    /* fall back below */
  }
  return copy[lang].services.find((item) => item.id === service)?.name ?? service
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
      service: await serviceName(db, lang, booking.service),
      date: humanDate(wall.slice(0, 10), lang),
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
