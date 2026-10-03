import type { BookingInput, BookingKind } from './booking'
import type { Lang, ServiceId } from './content'
import { defaultSchedule, type DayHours, type Schedule, type ScheduleBlock, type Weekday } from './schedule'
import { supabase } from './supabase'

const WEEKDAYS: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

type WeekRow = {
  weekday: string
  closed: boolean
  open: string | null
  close: string | null
}

type BlockRow = {
  date: string
  time: string | null
}

type OccupancyRow = {
  start: string
  minutes: number
}

type ServiceRow = {
  id: string
  price: string
  minutes: number
}

function isWeekday(value: string): value is Weekday {
  return (WEEKDAYS as readonly string[]).includes(value)
}

function isServiceId(value: string): value is ServiceId {
  return value === 'cut' || value === 'beard' || value === 'both'
}

function dayHours(row: WeekRow): DayHours {
  if (row.closed || !row.open || !row.close) return { closed: true }
  return { open: row.open, close: row.close }
}

function localStart(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 19)
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function toBlock(row: BlockRow): ScheduleBlock {
  const date = String(row.date).slice(0, 10)
  if (!row.time) return { date }
  return { date, time: row.time.slice(0, 5) }
}

async function read<T>(table: string, columns: string): Promise<T[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from(table).select(columns)
  if (error) throw new Error(error.message)
  return (data ?? []) as T[]
}

export const LIVE_SCHEDULE_KEY = 'barber-live-schedule'
const LIVE_EVENT = 'barber-live-schedule'

export type LiveSchedule = {
  week?: Schedule['week']
  blocks?: ScheduleBlock[]
  exceptions?: Schedule['exceptions']
  bookings?: Schedule['bookings']
}

export function readLiveSchedule(): LiveSchedule {
  try {
    const raw = localStorage.getItem(LIVE_SCHEDULE_KEY)
    return raw ? (JSON.parse(raw) as LiveSchedule) : {}
  } catch {
    return {}
  }
}

export function publishLiveSchedule(next: LiveSchedule) {
  localStorage.setItem(LIVE_SCHEDULE_KEY, JSON.stringify(next))
  window.dispatchEvent(new Event(LIVE_EVENT))
}

export function subscribeLiveSchedule(onChange: (live: LiveSchedule) => void): () => void {
  const notify = () => onChange(readLiveSchedule())
  const onStorage = (event: StorageEvent) => {
    if (event.key === LIVE_SCHEDULE_KEY) notify()
  }
  window.addEventListener(LIVE_EVENT, notify)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(LIVE_EVENT, notify)
    window.removeEventListener('storage', onStorage)
  }
}

export function mergeLiveSchedule(base: Schedule, live = readLiveSchedule()): Schedule {
  if (!live.week && !live.blocks && !live.exceptions && !live.bookings) return base
  return {
    ...base,
    week: live.week ?? base.week,
    blocks: live.blocks ?? base.blocks,
    exceptions: live.exceptions ?? base.exceptions,
    bookings: live.bookings ?? base.bookings,
  }
}

export async function loadPublicSchedule(): Promise<Schedule> {
  if (!supabase) return mergeLiveSchedule(defaultSchedule)
  const [weekRows, blockRows, occupancy] = await Promise.all([
    read<WeekRow>('schedule_week', 'weekday, closed, open, close'),
    read<BlockRow>('schedule_blocks', 'date, time'),
    read<OccupancyRow>('booking_occupancy', 'start, minutes'),
  ])
  const week = { ...defaultSchedule.week }
  for (const row of weekRows) {
    if (isWeekday(row.weekday)) week[row.weekday] = dayHours(row)
  }
  return mergeLiveSchedule({
    week,
    blocks: blockRows.map(toBlock),
    bookings: occupancy.map((row) => ({
      start: localStart(String(row.start)),
      minutes: row.minutes,
    })),
  })
}

export async function loadServices(): Promise<ServiceSave[]> {
  if (!supabase) return []
  const rows = await read<ServiceRow>('services', 'id, price, minutes')
  return rows.filter(isServiceRow).map((row) => ({
    id: row.id,
    price: row.price,
    minutes: row.minutes,
  }))
}

function isServiceRow(row: ServiceRow): row is ServiceRow & { id: ServiceId } {
  return isServiceId(row.id)
}

function failurePayload(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const record = data as { ok?: unknown; error?: unknown }
  if (record.ok === false && typeof record.error === 'string' && record.error) return record.error
  return null
}

async function invokeDetail(error: { message?: string; context?: unknown }): Promise<string> {
  let body: unknown = error.context
  if (body instanceof Response) {
    try {
      body = await body.json()
    } catch {
      body = null
    }
  }
  if (body && typeof body === 'object') {
    const record = body as { error?: unknown; message?: unknown }
    if (typeof record.error === 'string' && record.error) return record.error
    if (typeof record.message === 'string' && record.message) return record.message
  }
  return error.message || 'offline'
}

async function invokeOk(
  name: string,
  body: object,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: 'offline' }
  try {
    const { data, error } = await supabase.functions.invoke(name, { body })
    const failed = failurePayload(data)
    if (failed) return { ok: false, error: failed }
    if (error) return { ok: false, error: await invokeDetail(error) }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'offline' }
  }
}

async function invokeBooking(name: 'book' | 'request-custom', input: BookingInput & { lang: Lang }) {
  return invokeOk(name, input)
}

export function submitBook(input: BookingInput & { lang: Lang }) {
  return invokeBooking('book', input)
}

export function submitCustom(input: BookingInput & { lang: Lang }) {
  return invokeBooking('request-custom', input)
}

export type AdminWriteBody =
  | { type: 'blocks'; date: string; time: string; on: boolean }
  | { type: 'week'; week: Record<Weekday, DayHours> }

export async function adminWrite(
  body: AdminWriteBody,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return invokeOk('admin-write', body)
}

export type InboxRow = {
  id: string
  service: ServiceId
  name: string
  email: string
  phone: string
  start: string
  kind: BookingKind
  status: 'confirmed' | 'pending' | 'declined'
  mail_sent: boolean
}

export type ServiceSave = { id: ServiceId; price: string; minutes: number }

export type TemplateKey = 'thanks' | 'accepted' | 'declined'
export type TemplateLang = 'nl' | 'en'
export type TemplateSave = {
  key: TemplateKey
  lang: TemplateLang
  subject: string
  body: string
}

type BookingRow = {
  id: string
  service: string
  name: string
  email: string
  phone: string | null
  start: string
  kind: string
  status: string
  mail_sent: boolean | null
}

function isKind(value: string): value is BookingKind {
  return value === 'slot' || value === 'custom'
}

function isStatus(value: string): value is InboxRow['status'] {
  return value === 'confirmed' || value === 'pending' || value === 'declined'
}

function isTemplateKey(value: string): value is TemplateKey {
  return value === 'thanks' || value === 'accepted' || value === 'declined'
}

function isLang(value: string): value is TemplateLang {
  return value === 'nl' || value === 'en'
}

function toInbox(rows: BookingRow[]): InboxRow[] {
  const inbox: InboxRow[] = []
  for (const row of rows) {
    if (!isServiceId(row.service) || !isKind(row.kind) || !isStatus(row.status)) continue
    inbox.push({
      id: String(row.id),
      service: row.service,
      name: row.name,
      email: row.email,
      phone: row.phone ?? '',
      start: localStart(String(row.start)),
      kind: row.kind,
      status: row.status,
      mail_sent: Boolean(row.mail_sent),
    })
  }
  return inbox
}

export async function loadInbox(): Promise<InboxRow[]> {
  if (!supabase) throw new Error('offline')
  try {
    const { data, error } = await supabase.functions.invoke('inbox-list')
    if (error) throw new Error(await invokeDetail(error))
    const failed = failurePayload(data)
    if (failed) throw new Error(failed)
    if (!Array.isArray(data)) throw new Error('offline')
    return toInbox(data as BookingRow[])
  } catch (err) {
    if (err instanceof Error) throw err
    throw new Error('offline')
  }
}

type TemplateRow = { key: string; lang: string; subject: string; body: string }

function toTemplates(rows: TemplateRow[]): TemplateSave[] {
  const templates: TemplateSave[] = []
  for (const row of rows) {
    if (!isTemplateKey(row.key) || !isLang(row.lang)) continue
    if (typeof row.subject !== 'string' || typeof row.body !== 'string') continue
    templates.push({ key: row.key, lang: row.lang, subject: row.subject, body: row.body })
  }
  return templates
}

export async function loadTemplates(): Promise<TemplateSave[]> {
  if (!supabase) throw new Error('offline')
  try {
    const { data, error } = await supabase.functions.invoke('templates-list')
    if (error) throw new Error(await invokeDetail(error))
    const failed = failurePayload(data)
    if (failed) throw new Error(failed)
    if (!Array.isArray(data)) throw new Error('offline')
    return toTemplates(data as TemplateRow[])
  } catch (err) {
    if (err instanceof Error) throw err
    throw new Error('offline')
  }
}

export function decideInbox(id: string, action: 'accept' | 'decline') {
  return invokeOk('inbox-decide', { id, action })
}

export function sendClientMail(
  id: string,
  key: TemplateKey,
  draft?: { subject: string; body: string },
) {
  return invokeOk('send-mail', {
    id,
    key,
    ...(draft ? { subject: draft.subject, body: draft.body } : {}),
  })
}

export function saveServices(services: ServiceSave[]) {
  return invokeOk('admin-write', { type: 'services', services })
}

export function saveTemplates(templates: TemplateSave[]) {
  return invokeOk('admin-write', { type: 'templates', templates })
}
