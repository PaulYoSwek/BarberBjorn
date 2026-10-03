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

test('submitBook prefers the function error body over the generic invoke message', async () => {
  const invoke = vi.fn(async () => ({
    data: null,
    error: {
      message: 'Edge Function returned a non-2xx status code',
      context: new Response(JSON.stringify({ error: 'taken' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      }),
    },
  }))
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
  expect(await api.submitBook(input)).toEqual({ ok: false, error: 'taken' })
})

test('submitBook returns a 200 failure payload from data', async () => {
  const invoke = vi.fn(async () => ({
    data: { ok: false, error: 'Die tijd is al weg. Kies een vrije.' },
    error: null,
  }))
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
  expect(await api.submitBook(input)).toEqual({
    ok: false,
    error: 'Die tijd is al weg. Kies een vrije.',
  })
})

test('adminWrite fails closed without a supabase client', async () => {
  vi.doUnmock('./supabase')
  vi.resetModules()
  const api = await import('./planning-api')
  expect(await api.adminWrite({ type: 'blocks', date: '2026-10-05', time: '12:00', on: true })).toEqual({
    ok: false,
    error: 'offline',
  })
})

test('adminWrite invokes admin-write with the body', async () => {
  const invoke = vi.fn(async () => ({ data: { ok: true }, error: null }))
  vi.resetModules()
  vi.doMock('./supabase', () => ({ supabase: { functions: { invoke } } }))
  const api = await import('./planning-api')
  const body = { type: 'week' as const, week: defaultSchedule.week }
  expect(await api.adminWrite(body)).toEqual({ ok: true })
  expect(invoke).toHaveBeenCalledWith('admin-write', { body })
})

test('inbox mail and settings helpers fail closed without a supabase client', async () => {
  vi.doUnmock('./supabase')
  vi.resetModules()
  const api = await import('./planning-api')
  expect(api.loadInbox).toEqual(expect.any(Function))
  expect(api.loadTemplates).toEqual(expect.any(Function))
  expect(api.decideInbox).toEqual(expect.any(Function))
  expect(api.sendClientMail).toEqual(expect.any(Function))
  expect(api.saveServices).toEqual(expect.any(Function))
  expect(api.saveTemplates).toEqual(expect.any(Function))
  await expect(api.loadInbox()).rejects.toThrow('offline')
  await expect(api.loadTemplates()).rejects.toThrow('offline')
  expect(await api.decideInbox('b1', 'accept')).toEqual({ ok: false, error: 'offline' })
  expect(await api.sendClientMail('b1', 'thanks')).toEqual({ ok: false, error: 'offline' })
  expect(await api.saveServices([])).toEqual({ ok: false, error: 'offline' })
  expect(await api.saveTemplates([])).toEqual({ ok: false, error: 'offline' })
})

test('decide send and save invoke the admin edge functions', async () => {
  const invoke = vi.fn(async () => ({ data: { ok: true }, error: null }))
  vi.resetModules()
  vi.doMock('./supabase', () => ({ supabase: { functions: { invoke } } }))
  const api = await import('./planning-api')
  expect(await api.decideInbox('b1', 'decline')).toEqual({ ok: true })
  expect(invoke).toHaveBeenCalledWith('inbox-decide', { body: { id: 'b1', action: 'decline' } })
  expect(await api.sendClientMail('b1', 'accepted', { subject: 'S', body: 'B' })).toEqual({ ok: true })
  expect(invoke).toHaveBeenCalledWith('send-mail', {
    body: { id: 'b1', key: 'accepted', subject: 'S', body: 'B' },
  })
  const services = [{ id: 'cut' as const, price: '€30', minutes: 50 }]
  expect(await api.saveServices(services)).toEqual({ ok: true })
  expect(invoke).toHaveBeenCalledWith('admin-write', { body: { type: 'services', services } })
  const templates = [{ key: 'thanks' as const, lang: 'nl' as const, subject: 'S', body: 'B' }]
  expect(await api.saveTemplates(templates)).toEqual({ ok: true })
  expect(invoke).toHaveBeenCalledWith('admin-write', { body: { type: 'templates', templates } })
})

test('loadInbox invokes inbox-list and does not select bookings', async () => {
  const bookings = [
    {
      id: '1',
      service: 'cut',
      name: 'Sam',
      email: 'sam@mail.nl',
      phone: '',
      start: '2026-10-06T12:00:00Z',
      kind: 'custom',
      status: 'pending',
      mail_sent: false,
    },
    {
      id: '2',
      service: 'nope',
      name: 'X',
      email: 'x@mail.nl',
      phone: '',
      start: '2026-10-06T12:00:00',
      kind: 'slot',
      status: 'confirmed',
      mail_sent: true,
    },
  ]
  const invoke = vi.fn(async (name: string) => {
    if (name === 'inbox-list') return { data: bookings, error: null }
    return { data: null, error: { message: 'missing' } }
  })
  const from = vi.fn((table: string) => ({
    select: vi.fn(async () => ({
      data: table === 'mail_templates'
        ? [
            { key: 'thanks', lang: 'nl', subject: 'Hoi', body: 'Tot dan' },
            { key: 'other', lang: 'nl', subject: 'Nee', body: 'Nee' },
          ]
        : [],
      error: null,
    })),
  }))
  vi.resetModules()
  vi.doMock('./supabase', () => ({ supabase: { from, functions: { invoke } } }))
  const api = await import('./planning-api')
  const inbox = await api.loadInbox()
  expect(invoke).toHaveBeenCalledWith('inbox-list')
  expect(from).not.toHaveBeenCalledWith('bookings')
  expect(from).not.toHaveBeenCalledWith('mail_templates')
  expect(inbox).toHaveLength(1)
  expect(inbox[0]?.id).toBe('1')
  expect(inbox[0]?.service).toBe('cut')
  expect(inbox[0]?.status).toBe('pending')
  expect(inbox[0]?.mail_sent).toBe(false)
  expect(inbox[0]?.start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)
  expect(new Date(inbox[0]!.start).getTime()).toBe(new Date('2026-10-06T12:00:00Z').getTime())
})

test('loadTemplates invokes templates-list and does not select mail_templates', async () => {
  const invoke = vi.fn(async (name: string) => {
    if (name === 'templates-list') {
      return {
        data: [
          { key: 'thanks', lang: 'nl', subject: 'Hoi', body: 'Tot dan' },
          { key: 'other', lang: 'nl', subject: 'Nee', body: 'Nee' },
        ],
        error: null,
      }
    }
    return { data: null, error: { message: 'missing' } }
  })
  const from = vi.fn(() => ({
    select: vi.fn(async () => ({
      data: [{ key: 'thanks', lang: 'nl', subject: 'table', body: 'table' }],
      error: null,
    })),
  }))
  vi.resetModules()
  vi.doMock('./supabase', () => ({ supabase: { from, functions: { invoke } } }))
  const api = await import('./planning-api')
  expect(await api.loadTemplates()).toEqual([{ key: 'thanks', lang: 'nl', subject: 'Hoi', body: 'Tot dan' }])
  expect(invoke).toHaveBeenCalledWith('templates-list')
  expect(from).not.toHaveBeenCalled()
})

test('loadTemplates returns a successful empty array', async () => {
  const invoke = vi.fn(async () => ({ data: [], error: null }))
  const from = vi.fn()
  vi.resetModules()
  vi.doMock('./supabase', () => ({ supabase: { from, functions: { invoke } } }))
  const api = await import('./planning-api')
  expect(await api.loadTemplates()).toEqual([])
  expect(invoke).toHaveBeenCalledWith('templates-list')
  expect(from).not.toHaveBeenCalled()
})

test('loadTemplates rejects when templates-list fails', async () => {
  const invoke = vi.fn(async () => ({ data: null, error: { message: 'permission denied' } }))
  vi.resetModules()
  vi.doMock('./supabase', () => ({ supabase: { functions: { invoke } } }))
  const api = await import('./planning-api')
  await expect(api.loadTemplates()).rejects.toThrow('permission denied')
})

test('loadInbox treats an empty inbox-list payload as an empty inbox', async () => {
  const invoke = vi.fn(async () => ({ data: [], error: null }))
  const from = vi.fn()
  vi.resetModules()
  vi.doMock('./supabase', () => ({ supabase: { from, functions: { invoke } } }))
  const api = await import('./planning-api')
  expect(await api.loadInbox()).toEqual([])
  expect(invoke).toHaveBeenCalledWith('inbox-list')
  expect(from).not.toHaveBeenCalled()
})

test('loadInbox rejects when inbox-list fails', async () => {
  const invoke = vi.fn(async () => ({ data: null, error: { message: 'permission denied' } }))
  vi.resetModules()
  vi.doMock('./supabase', () => ({ supabase: { functions: { invoke } } }))
  const api = await import('./planning-api')
  await expect(api.loadInbox()).rejects.toThrow('permission denied')
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
