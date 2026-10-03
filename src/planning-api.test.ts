import { expect, test, vi } from 'vitest'
import { defaultSchedule } from './schedule'
import { loadPublicSchedule, loadServices } from './planning-api'

test('supabase client stays null without env', async () => {
  const { supabase } = await import('./supabase')
  expect(supabase).toBeNull()
})

test('maps occupancy rows into booking holds', async () => {
  const schedule = await loadPublicSchedule()
  expect(schedule.week.sat).toEqual({ closed: true })
  expect(schedule).toEqual(defaultSchedule)
})

test('loadServices returns no rows without supabase env', async () => {
  expect(await loadServices()).toEqual([])
})

test('maps live week blocks and occupancy into a schedule', async () => {
  const tables: Record<string, unknown[]> = {
    schedule_week: [
      { weekday: 'mon', closed: false, open: '10:00', close: '16:00' },
      { weekday: 'tue', closed: false, open: '09:00', close: '18:00' },
      { weekday: 'wed', closed: false, open: '09:00', close: '18:00' },
      { weekday: 'thu', closed: false, open: '09:00', close: '18:00' },
      { weekday: 'fri', closed: false, open: '09:00', close: '18:00' },
      { weekday: 'sat', closed: true, open: null, close: null },
      { weekday: 'sun', closed: true, open: null, close: null },
    ],
    schedule_blocks: [
      { date: '2026-10-12', time: null },
      { date: '2026-10-13', time: '12:00:00' },
    ],
    booking_occupancy: [
      { start: '2026-10-05T10:00:00', minutes: 45 },
      { start: '2026-10-06T12:00:00Z', minutes: 60 },
    ],
    services: [
      { id: 'cut', price: '€32', minutes: 40 },
      { id: 'beard', price: '€18', minutes: 25 },
      { id: 'both', price: '€45', minutes: 70 },
    ],
  }
  const from = vi.fn((table: string) => ({
    select: vi.fn(async () => ({ data: tables[table] ?? [], error: null })),
  }))

  vi.resetModules()
  vi.doMock('./supabase', () => ({ supabase: { from } }))
  const api = await import('./planning-api')
  const schedule = await api.loadPublicSchedule()
  const listed = await api.loadServices()
  const zoned = schedule.bookings?.[1]

  expect(from).toHaveBeenCalledWith('schedule_week')
  expect(from).toHaveBeenCalledWith('schedule_blocks')
  expect(from).toHaveBeenCalledWith('booking_occupancy')
  expect(from).toHaveBeenCalledWith('services')
  expect(schedule.week.mon).toEqual({ open: '10:00', close: '16:00' })
  expect(schedule.week.sat).toEqual({ closed: true })
  expect(schedule.blocks).toEqual([
    { date: '2026-10-12' },
    { date: '2026-10-13', time: '12:00' },
  ])
  expect(schedule.bookings?.[0]).toEqual({ start: '2026-10-05T10:00:00', minutes: 45 })
  expect(zoned?.minutes).toBe(60)
  expect(zoned?.start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)
  expect(new Date(zoned!.start).getTime()).toBe(new Date('2026-10-06T12:00:00Z').getTime())
  expect(schedule.bookings).not.toEqual(defaultSchedule.bookings)
  expect(listed).toEqual(tables.services)
})

test('submit wrappers fail closed without a supabase client', async () => {
  vi.doUnmock('./supabase')
  vi.resetModules()
  const api = await import('./planning-api')
  const input = {
    service: 'cut' as const,
    name: 'Sam',
    email: 'sam@mail.nl',
    phone: '',
    slot: '2026-10-06T09:00:00',
    kind: 'slot' as const,
    lang: 'nl' as const,
  }
  expect(await api.submitBook(input)).toEqual({ ok: false, error: 'offline' })
  expect(await api.submitCustom({ ...input, kind: 'custom' })).toEqual({ ok: false, error: 'offline' })
})

test('submitBook invokes book and submitCustom invokes request-custom', async () => {
  const invoke = vi.fn(async (name: string) => {
    if (name === 'request-custom') return { data: null, error: { message: 'closed' } }
    return { data: {}, error: null }
  })
  vi.resetModules()
  vi.doMock('./supabase', () => ({ supabase: { functions: { invoke } } }))
  const api = await import('./planning-api')
  const input = {
    service: 'cut' as const,
    name: 'Sam',
    email: 'sam@mail.nl',
    phone: '',
    slot: '2026-10-06T09:00:00',
    kind: 'slot' as const,
    lang: 'nl' as const,
  }
  expect(await api.submitBook(input)).toEqual({ ok: true })
  expect(invoke).toHaveBeenCalledWith('book', { body: input })
  const custom = { ...input, kind: 'custom' as const }
  expect(await api.submitCustom(custom)).toEqual({ ok: false, error: 'closed' })
  expect(invoke).toHaveBeenCalledWith('request-custom', { body: custom })
})

test('loadPublicSchedule throws when a read fails', async () => {
  vi.resetModules()
  vi.doMock('./supabase', () => ({
    supabase: {
      from: () => ({
        select: async () => ({ data: null, error: { message: 'permission denied' } }),
      }),
    },
  }))
  const { loadPublicSchedule: load } = await import('./planning-api')
  await expect(load()).rejects.toThrow('permission denied')
})
