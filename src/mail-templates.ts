import { CONTACT, copy, type Lang } from './content.ts'

export type MailKey = 'thanks' | 'accepted' | 'declined' | 'moved'

export const MAIL_KEYS: MailKey[] = ['thanks', 'accepted', 'declined', 'moved']

/** Dashboard names for the templates. */
export const MAIL_LABEL: Record<MailKey, string> = {
  thanks: 'Bedankt voor je boeking',
  accepted: 'Ander tijdstip bevestigd',
  declined: 'Ander tijdstip geweigerd',
  moved: 'Afspraak verplaatst',
}

const ADDRESS = CONTACT.addressLine

/**
 * Starting texts for every mail. Bjorn can change them under Settings; these
 * are used until he does, and whenever a stored template is missing.
 * Placeholders: {{name}} {{service}} {{date}} {{time}}.
 */
export const MAIL_TEMPLATES: Record<MailKey, Record<Lang, { subject: string; body: string }>> = {
  thanks: {
    nl: {
      subject: 'Je afspraak bij Bjorn’s Barber staat vast',
      body: `Hoi {{name}},

Bedankt voor je boeking. Je afspraak staat vast:

{{service}}
{{date}} om {{time}}
${ADDRESS}

Lukt het toch niet? Stuur even een mail terug, dan zoeken we een ander moment.

Tot dan,
Bjorn`,
    },
    en: {
      subject: 'Your appointment at Bjorn’s Barber is booked',
      body: `Hi {{name}},

Thanks for booking. Your appointment is set:

{{service}}
{{date}} at {{time}}
${ADDRESS}

Can't make it after all? Just reply to this mail and we'll find another time.

See you then,
Bjorn`,
    },
  },
  accepted: {
    nl: {
      subject: 'Je afspraak bij Bjorn’s Barber is bevestigd',
      body: `Hoi {{name}},

Goed nieuws: je gevraagde tijd past. Je afspraak staat vast:

{{service}}
{{date}} om {{time}}
${ADDRESS}

Tot dan,
Bjorn`,
    },
    en: {
      subject: 'Your appointment at Bjorn’s Barber is confirmed',
      body: `Hi {{name}},

Good news: the time you asked for works. Your appointment is set:

{{service}}
{{date}} at {{time}}
${ADDRESS}

See you then,
Bjorn`,
    },
  },
  declined: {
    nl: {
      subject: 'Dat tijdstip lukt helaas niet',
      body: `Hoi {{name}},

{{date}} om {{time}} lukt helaas niet. Kies een vrije tijd op de site, of stuur een mail terug, dan zoeken we samen een ander moment.

Groet,
Bjorn`,
    },
    en: {
      subject: "That time doesn't work, sorry",
      body: `Hi {{name}},

{{date}} at {{time}} doesn't work, sorry. Pick a free time on the site, or reply to this mail and we'll find another moment together.

Best,
Bjorn`,
    },
  },
  moved: {
    nl: {
      subject: 'Je afspraak bij Bjorn’s Barber is verplaatst',
      body: `Hoi {{name}},

Je afspraak is verplaatst naar een nieuw moment:

{{service}}
{{date}} om {{time}}
${ADDRESS}

Past dit niet? Stuur even een mail terug, dan zoeken we een ander moment.

Tot dan,
Bjorn`,
    },
    en: {
      subject: 'Your appointment at Bjorn’s Barber has moved',
      body: `Hi {{name}},

Your appointment has moved to a new time:

{{service}}
{{date}} at {{time}}
${ADDRESS}

Doesn't this work for you? Just reply to this mail and we'll find another time.

See you then,
Bjorn`,
    },
  },
}

const WEEKDAY_NAMES: Record<Lang, string[]> = {
  nl: ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
}

/** "2026-10-07" → "woensdag 7 oktober" / "Wednesday 7 October". */
export function humanDate(date: string, lang: Lang): string {
  const day = new Date(`${date.slice(0, 10)}T12:00:00Z`)
  if (Number.isNaN(day.getTime())) return date
  const weekday = WEEKDAY_NAMES[lang][day.getUTCDay()]
  const month = copy[lang].months[day.getUTCMonth()]
  return `${weekday} ${day.getUTCDate()} ${month}`
}

/** Which template fits a booking when Bjorn mails it again. */
export function templateFor(booking: { status: string; kind: string }): MailKey {
  if (booking.status === 'declined') return 'declined'
  if (booking.kind === 'custom') return 'accepted'
  return 'thanks'
}
