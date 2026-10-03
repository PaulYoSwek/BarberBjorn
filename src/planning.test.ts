import { expect, test } from 'vitest'
import { defaultSchedule } from './schedule'
import { fillTemplate, isFree, weekHoursFromDays } from './planning'

test('apply week keeps Saturday closed from the viewed days', () => {
  const week = weekHoursFromDays([
    { weekday: 'mon', hours: { open: '10:00', close: '16:00' } },
    { weekday: 'tue', hours: { open: '09:00', close: '18:00' } },
    { weekday: 'wed', hours: { open: '09:00', close: '18:00' } },
    { weekday: 'thu', hours: { open: '09:00', close: '18:00' } },
    { weekday: 'fri', hours: { open: '09:00', close: '18:00' } },
    { weekday: 'sat', hours: { closed: true } },
    { weekday: 'sun', hours: { closed: true } },
  ])
  expect(week.mon).toEqual({ open: '10:00', close: '16:00' })
  expect(week.sat).toEqual({ closed: true })
})

test('isFree is false on a confirmed hold and true on a pending-only world', () => {
  const taken = { ...defaultSchedule, bookings: [{ start: '2026-10-05T10:00:00', minutes: 45 }] }
  expect(isFree('2026-10-05T10:00:00', 45, taken)).toBe(false)
  expect(isFree('2026-10-05T09:00:00', 45, taken)).toBe(true)
})

test('fillTemplate substitutes the four tokens', () => {
  expect(
    fillTemplate('Hoi {{name}}, {{service}} op {{date}} om {{time}}.', {
      name: 'Sam',
      service: 'Knippen',
      date: '6 okt',
      time: '09:00',
    }),
  ).toBe('Hoi Sam, Knippen op 6 okt om 09:00.')
})
