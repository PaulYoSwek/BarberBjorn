import { expect, test } from 'vitest'
import { defaultSchedule } from './schedule'
import { addDaysIso, fillTemplate, isFree, weekHoursFromDays, weeklyBlockRows } from './planning'

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
  const now = new Date('2026-10-03T12:00:00')
  const taken = { ...defaultSchedule, bookings: [{ start: '2026-10-05T10:00:00', minutes: 45 }] }
  expect(isFree('2026-10-05T10:00:00', 45, taken, now)).toBe(false)
  expect(isFree('2026-10-05T09:00:00', 45, taken, now)).toBe(true)
})

test('isFree rejects slots that already started when now is passed', () => {
  const noon = new Date('2026-10-05T12:00:00')
  expect(isFree('2026-10-05T09:00:00', 45, defaultSchedule, noon)).toBe(false)
  expect(isFree('2026-10-05T14:00:00', 45, defaultSchedule, noon)).toBe(true)
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

test('weekly block rows stamp each weekday pattern onto every later week', () => {
  const rows = weeklyBlockRows('2026-10-12', 2, {
    mon: [{ time: '12:00', reason: 'Lunch', color: 'green' }, { time: '12:15', reason: 'Lunch', color: 'green' }],
    wed: [{ time: '15:00' }],
  })
  expect(rows).toEqual([
    { date: '2026-10-12', time: '12:00', reason: 'Lunch', color: 'green' },
    { date: '2026-10-12', time: '12:15', reason: 'Lunch', color: 'green' },
    { date: '2026-10-14', time: '15:00', reason: '', color: '' },
    { date: '2026-10-19', time: '12:00', reason: 'Lunch', color: 'green' },
    { date: '2026-10-19', time: '12:15', reason: 'Lunch', color: 'green' },
    { date: '2026-10-21', time: '15:00', reason: '', color: '' },
  ])
})

test('addDaysIso walks across a daylight saving change without skipping a date', () => {
  expect(addDaysIso('2026-10-24', 1)).toBe('2026-10-25')
  expect(addDaysIso('2026-10-25', 1)).toBe('2026-10-26')
  expect(addDaysIso('2026-10-12', 52 * 7 - 1)).toBe('2027-10-10')
})
