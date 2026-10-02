import { expect, test } from 'vitest'
import { mailtoHref, validateBooking } from './booking'
import { copy } from './content'

const today = '2026-10-05' // a Monday

test('rejects empty fields, past dates, and weekends', () => {
  const empty = validateBooking({ service: '', name: ' ', phone: '12', day: '' }, copy.nl, today)
  expect(empty.ok).toBe(false)
  if (!empty.ok) {
    expect(empty.errors.service).toBe('Vul dit nog even in.')
    expect(empty.errors.name).toBe('Vul dit nog even in.')
    expect(empty.errors.phone).toBe('Vul dit nog even in.')
    expect(empty.errors.day).toBe('Vul dit nog even in.')
  }

  const past = validateBooking({ service: 'cut', name: 'Bjorn', phone: '0612345678', day: '2026-10-04' }, copy.nl, today)
  expect(past.ok).toBe(false)
  if (!past.ok) expect(past.errors.day).toBe('Die dag is al geweest. Kies vandaag of later.')

  const saturday = validateBooking({ service: 'cut', name: 'Bjorn', phone: '0612345678', day: '2026-10-10' }, copy.en, today)
  expect(saturday.ok).toBe(false)
  if (!saturday.ok) expect(saturday.errors.day).toBe('Saturday and Sunday the chair is closed. Pick a weekday.')
})

test('builds a Dutch mailto body without storing anything', () => {
  const result = validateBooking(
    { service: 'both', name: '  Sam  ', phone: '06 12 34 56 78', day: '2026-10-06' },
    copy.nl,
    today,
  )
  expect(result.ok).toBe(true)
  if (result.ok) {
    expect(result.subject).toBe('Afspraak BarberBjorn')
    expect(result.body).toContain('Dienst: Allebei')
    expect(result.body).toContain('Naam: Sam')
    expect(result.body).toContain('Telefoon: 06 12 34 56 78')
    expect(result.body).toContain('Dag: 2026-10-06')
    expect(result.body).toContain('Dit is een aanvraag, nog geen bevestiging.')
    expect(mailtoHref('hallo@barberbjorn.nl', result.subject, result.body)).toContain('mailto:hallo@barberbjorn.nl')
  }
})
