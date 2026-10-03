import { expect, test } from 'vitest'
import { defaultSchedule } from './schedule'
import { copyWeekClosures, fillTemplate, isFree, weekHoursFromDays } from './planning'

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

test('copy week closures stamps closed days and times onto later same weekdays', () => {
  const source = [
    { date: '2026-10-05', weekday: 'mon' as const },
    { date: '2026-10-06', weekday: 'tue' as const },
    { date: '2026-10-07', weekday: 'wed' as const },
  ]
  const later = [
    { date: '2026-10-12', weekday: 'mon' as const },
    { date: '2026-10-13', weekday: 'tue' as const },
    { date: '2026-10-14', weekday: 'wed' as const },
  ]
  const copied = copyWeekClosures(source, later, [
    { date: '2026-10-05' },
    { date: '2026-10-06', time: '15:00' },
    { date: '2026-10-20', time: '11:00' },
  ])
  expect(copied).toEqual(
    expect.arrayContaining([
      { date: '2026-10-05' },
      { date: '2026-10-12' },
      { date: '2026-10-06', time: '15:00' },
      { date: '2026-10-13', time: '15:00' },
      { date: '2026-10-20', time: '11:00' },
    ]),
  )
  expect(copied.some((block) => block.date === '2026-10-14')).toBe(false)
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
