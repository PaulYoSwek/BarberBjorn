import { expect, test } from 'vitest'
import { salonWallToUtc, utcToSalonWall } from '../supabase/functions/_shared/salon'
import { applyDecision } from './planning'
import { defaultSchedule, type Schedule } from './schedule'

function futureWeekdayAt(time: string): string {
  const now = new Date()
  for (let add = 1; add <= 21; add++) {
    const day = new Date(now)
    day.setDate(day.getDate() + add)
    const weekday = day.getDay()
    if (weekday === 0 || weekday === 6) continue
    const pad = (part: number) => String(part).padStart(2, '0')
    const date = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
    return `${date}T${time}:00`
  }
  throw new Error('no weekday')
}

test('accept of a held start returns overlap', () => {
  const start = futureWeekdayAt('11:00')
  const schedule: Schedule = {
    ...defaultSchedule,
    bookings: [{ start, minutes: 45 }],
  }
  expect(applyDecision({ start, minutes: 45, status: 'pending' }, 'accept', schedule)).toEqual({
    error: 'overlap',
  })
})

test('decline returns declined even when the start is held', () => {
  const start = futureWeekdayAt('11:00')
  const schedule: Schedule = {
    ...defaultSchedule,
    bookings: [{ start, minutes: 45 }],
  }
  expect(applyDecision({ start, minutes: 45, status: 'pending' }, 'decline', schedule)).toEqual({
    status: 'declined',
  })
})

test('accept of a free start returns confirmed', () => {
  const start = futureWeekdayAt('11:00')
  expect(applyDecision({ start, minutes: 45, status: 'pending' }, 'accept', defaultSchedule)).toEqual({
    status: 'confirmed',
  })
})

function futureSaturdayAt(time: string): string {
  const now = new Date()
  for (let add = 1; add <= 21; add++) {
    const day = new Date(now)
    day.setDate(day.getDate() + add)
    if (day.getDay() !== 6) continue
    const pad = (part: number) => String(part).padStart(2, '0')
    const date = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
    return `${date}T${time}:00`
  }
  throw new Error('no saturday')
}

test('accept of a future off-grid start with empty bookings is confirmed', () => {
  const start = futureSaturdayAt('19:30')
  const schedule: Schedule = { ...defaultSchedule, bookings: [] }
  expect(applyDecision({ start, minutes: 45, status: 'pending' }, 'accept', schedule)).toEqual({
    status: 'confirmed',
  })
})

test('accept of an off-grid start that overlaps a confirmed hold is overlap', () => {
  const start = futureSaturdayAt('19:30')
  const hold = start.replace('T19:30:00', 'T19:00:00')
  const schedule: Schedule = {
    ...defaultSchedule,
    bookings: [{ start: hold, minutes: 60 }],
  }
  expect(applyDecision({ start, minutes: 45, status: 'pending' }, 'accept', schedule)).toEqual({
    error: 'overlap',
  })
})

test('salon wall clock converts to the Amsterdam instant', () => {
  expect(salonWallToUtc('2026-10-05T10:00:00')).toBe('2026-10-05T08:00:00.000Z')
  expect(utcToSalonWall('2026-10-05T08:00:00.000Z')).toBe('2026-10-05T10:00:00')
  expect(salonWallToUtc('2026-01-05T10:00:00')).toBe('2026-01-05T09:00:00.000Z')
  expect(utcToSalonWall('2026-01-05T09:00:00.000Z')).toBe('2026-01-05T10:00:00')
  expect(utcToSalonWall('2026-10-05T10:00:00')).toBe('2026-10-05T10:00:00')
})
