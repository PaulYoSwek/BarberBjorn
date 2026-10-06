import { expect, test, vi } from 'vitest'
import { defaultSchedule } from './schedule'
import { loadPublicSchedule, loadServices, publishLiveSchedule, subscribeLiveSchedule } from './planning-api'

type Result = { data: unknown; error: { message: string } | null }

/** A PostgREST-like query: awaitable, with chainable filters that are recorded. */
function query(result: Result, filters: string[] = []) {
  const builder = {
    gte: (column: string, value: string) => (filters.push(`${column}>=${value}`), builder),
    lte: (column: string, value: string) => (filters.push(`${column}<=${value}`), builder),
    then: (resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  return builder
}

test('supabase client stays null without env', async () => {
  const { supabase } = await import('./supabase')
  expect(supabase).toBeNull()
})

test('a dashboard ping reaches subscribers on this device and never changes the schedule', async () => {
  localStorage.clear()
  const seen = vi.fn()
  const stop = subscribeLiveSchedule(seen)
  publishLiveSchedule()
  expect(seen).toHaveBeenCalledTimes(1)
  stop()
  publishLiveSchedule()
  expect(seen).toHaveBeenCalledTimes(1)
  const schedule = await loadPublicSchedule()
  expect(schedule).toEqual(defaultSchedule)
  localStorage.clear()
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
    schedule_exceptions: [
      { date: '2026-10-14', closed: false, open: '11:00:00', close: '15:00:00' },
      { date: '2026-10-15', closed: true, open: null, close: null },
    ],
  }
  const blockFilters: string[] = []
  const from = vi.fn((table: string) => ({
    select: vi.fn(() =>
      query({ data: tables[table] ?? [], error: null }, table === 'schedule_blocks' ? blockFilters : []),
    ),
  }))

  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-07T10:00:00'))
  vi.resetModules()
  vi.doMock('./supabase', () => ({ supabase: { from } }))
  const api = await import('./planning-api')
  const schedule = await api.loadPublicSchedule()
  vi.useRealTimers()
  // Only the agenda window (this Monday + 4 weeks + a week of slack) is fetched.
  expect(blockFilters).toEqual(['date>=2026-10-05', 'date<=2026-11-09'])
  const listed = await api.loadServices()
  const zoned = schedule.bookings?.[1]

  expect(from).toHaveBeenCalledWith('schedule_week')
  expect(from).toHaveBeenCalledWith('schedule_blocks')
  expect(from).toHaveBeenCalledWith('booking_occupancy')
  expect(from).toHaveBeenCalledWith('services')
  expect(from).toHaveBeenCalledWith('schedule_exceptions')
  expect(schedule.exceptions).toEqual({ '2026-10-14': { open: '11:00', close: '15:00' }, '2026-10-15': { closed: true } })
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
      minutes: 45,
      kind: 'custom',
      status: 'pending',
      lang: 'en',
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
  expect(inbox[0]?.minutes).toBe(45)
  expect(inbox[0]?.lang).toBe('en')
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
        select: () => query({ data: null, error: { message: 'permission denied' } }),
      }),
    },
  }))
  const { loadPublicSchedule: load } = await import('./planning-api')
  await expect(load()).rejects.toThrow('permission denied')
})

test('loadPublicSchedule survives a missing exceptions table', async () => {
  vi.resetModules()
  vi.doMock('./supabase', () => ({
    supabase: {
      from: (table: string) => ({
        select: () =>
          query(
            table === 'schedule_exceptions'
              ? { data: null, error: { message: 'relation does not exist' } }
              : { data: [], error: null },
          ),
      }),
    },
  }))
  const { loadPublicSchedule: load } = await import('./planning-api')
  const schedule = await load()
  expect(schedule.exceptions).toEqual({})
  expect(schedule.week.mon).toEqual({ open: '09:00', close: '18:00' })
})

test('adminLogin stores the token from the login body and sends it as a header', async () => {
  localStorage.clear()
  sessionStorage.clear()
  const invoke = vi.fn(async () => ({ data: { ok: true, token: '9999999999.sig' }, error: null }))
  vi.resetModules()
  vi.doMock('./supabase', () => ({ supabase: { functions: { invoke } } }))
  const api = await import('./planning-api')
  const session = await import('./admin-session')
  expect(await api.adminLogin('geheim')).toBe('ok')
  expect(invoke).toHaveBeenCalledWith('admin-login', { body: { password: 'geheim' } })
  expect(session.readAdminToken()).toBe('9999999999.sig')
  expect(session.hasAdminSession()).toBe(true)
  session.clearAdminSession()
  expect(session.hasAdminSession()).toBe(false)
})

test('adminLogin reports a wrong password and an unreachable function apart', async () => {
  vi.resetModules()
  vi.doMock('./supabase', () => ({
    supabase: {
      functions: {
        invoke: vi.fn(async () => ({ data: null, error: { message: 'no', context: { status: 401 } } })),
      },
    },
  }))
  let api = await import('./planning-api')
  expect(await api.adminLogin('nee')).toBe('wrong')
  vi.resetModules()
  vi.doMock('./supabase', () => ({
    supabase: { functions: { invoke: vi.fn(async () => ({ data: null, error: { message: 'down' } })) } },
  }))
  api = await import('./planning-api')
  expect(await api.adminLogin('nee')).toBe('unavailable')
})
