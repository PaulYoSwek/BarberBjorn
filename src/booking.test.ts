import { expect, test } from 'vitest'
import { mailtoHref, validateBooking } from './booking'
import { copy } from './content'

const today = '2026-10-05'

const base = {
  service: 'cut' as const,
  name: 'Sam',
  email: 'sam@mail.nl',
  phone: '',
  slot: '2026-10-06T09:00:00',
  kind: 'slot' as const,
}

test('rejects empty fields, past slots, closed days, and taken times', () => {
  const empty = validateBooking(
    { service: '', name: ' ', email: 'sam@mail.nl', phone: '12', slot: '', kind: 'slot' },
    copy.nl,
    today,
  )
  expect(empty.ok).toBe(false)
  if (!empty.ok) {
    expect(empty.errors.service).toBe('Vul dit nog even in.')
    expect(empty.errors.name).toBe('Vul dit nog even in.')
    expect(empty.errors.slot).toBe('Vul dit nog even in.')
  }

  const past = validateBooking(
    { service: 'cut', name: 'Bjorn', email: 'sam@mail.nl', phone: '0612345678', slot: '2026-10-04T09:00:00', kind: 'slot' },
    copy.nl,
    today,
  )
  expect(past.ok).toBe(false)
  if (!past.ok) expect(past.errors.slot).toBe('Die dag is al geweest. Kies vandaag of later.')

  const saturday = validateBooking(
    { service: 'cut', name: 'Bjorn', email: 'sam@mail.nl', phone: '0612345678', slot: '2026-10-10T09:00:00', kind: 'slot' },
    copy.en,
    today,
  )
  expect(saturday.ok).toBe(false)
  if (!saturday.ok) expect(saturday.errors.slot).toBe('Saturday and Sunday the chair is closed. Pick a weekday.')

  const taken = validateBooking(
    { service: 'cut', name: 'Bjorn', email: 'sam@mail.nl', phone: '0612345678', slot: '2026-10-05T10:00:00', kind: 'slot' },
    copy.nl,
    today,
  )
  expect(taken.ok).toBe(false)
  if (!taken.ok) expect(taken.errors.slot).toBe('Die tijd is al weg. Kies een vrije.')
})

test('requires email and allows an empty phone on a free slot', () => {
  const missing = validateBooking({ ...base, email: '' }, copy.nl, today)
  expect(missing.ok).toBe(false)
  if (!missing.ok) expect(missing.errors.email).toBe('Vul dit nog even in.')

  const ok = validateBooking(base, copy.nl, today)
  expect(ok.ok).toBe(true)
})

test('a custom time need not sit on the published grid', () => {
  const result = validateBooking(
    { ...base, kind: 'custom', slot: '2026-10-10T19:30:00' },
    copy.nl,
    today,
  )
  expect(result.ok).toBe(true)
})

test('builds a Dutch mailto body with the chosen time', () => {
  const result = validateBooking(
    {
      service: 'both',
      name: '  Sam  ',
      email: 'sam@mail.nl',
      phone: '06 12 34 56 78',
      slot: '2026-10-06T09:00:00',
      kind: 'slot',
    },
    copy.nl,
    today,
  )
  expect(result.ok).toBe(true)
  if (result.ok) {
    expect(result.subject).toBe('Afspraak BarberBjorn')
    expect(result.body).toContain('Dienst: Allebei')
    expect(result.body).toContain('Naam: Sam')
    expect(result.body).toContain('Telefoon: 06 12 34 56 78')
    expect(result.body).toContain('Tijd: 2026-10-06 09:00')
    expect(result.body).toContain('Dit is een aanvraag, nog geen bevestiging.')
    expect(mailtoHref('hallo@barberbjorn.nl', result.subject, result.body)).toContain('mailto:hallo@barberbjorn.nl')
  }
})

test('accepts a weekday four weeks out', () => {
  const result = validateBooking(
    { service: 'cut', name: 'Sam', email: 'sam@mail.nl', phone: '0612345678', slot: '2026-10-26T09:00:00', kind: 'slot' },
    copy.nl,
    today,
  )
  expect(result.ok).toBe(true)
})
