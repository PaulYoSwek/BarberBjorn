import { storeAdminSession } from './admin-session'
import type { BookingInput, BookingKind } from './booking'
import type { ClientRecord } from './clients'
import { MAIL_KEYS, type MailKey } from './mail-templates'
import type { BlockPattern } from './planning'
import type { OrderItem, Product } from './finance'
import type { Lang, ServiceId } from './content'
import {
  AGENDA_DAYS,
  dateIso,
  defaultSchedule,
  mondayOf,
  SERVICE_MINUTES,
  type DayHours,
  type Schedule,
  type ScheduleBlock,
  type Weekday,
} from './schedule'
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
  reason?: string | null
  color?: string | null
}

type ExceptionRow = {
  date: string
  closed: boolean
  open: string | null
  close: string | null
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

function dayHours(row: { closed: boolean; open: string | null; close: string | null }): DayHours {
  if (row.closed || !row.open || !row.close) return { closed: true }
  return { open: row.open.slice(0, 5), close: row.close.slice(0, 5) }
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
  const note = {
    ...(row.reason ? { reason: row.reason } : {}),
    ...(row.color ? { color: row.color } : {}),
  }
  if (!row.time) return { date, ...note }
  return { date, time: row.time.slice(0, 5), ...note }
}

async function read<T>(table: string, columns: string): Promise<T[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from(table).select(columns)
  if (error) throw new Error(error.message)
  return (data ?? []) as T[]
}

/** Rows whose `date` falls in [from, to]. Keeps a year of copied blocks out of every page load. */
async function readDates<T>(table: string, columns: string, from: string, to: string): Promise<T[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from(table).select(columns).gte('date', from).lte('date', to)
  if (error) throw new Error(error.message)
  return (data ?? []) as T[]
}

/** The agenda shows four weeks from this Monday; a week of slack covers the page staying open. */
function agendaRange(now = new Date()): { from: string; to: string } {
  const monday = mondayOf(now)
  const last = new Date(monday)
  last.setDate(last.getDate() + AGENDA_DAYS + 7)
  return { from: dateIso(monday), to: dateIso(last) }
}

export const LIVE_SCHEDULE_KEY = 'barber-live-schedule'
const LIVE_EVENT = 'barber-live-schedule'

/**
 * Supabase is the source of truth. The dashboard only pings other tabs on
 * this device so the public agenda reloads right away after a change.
 */
export function publishLiveSchedule() {
  try {
    localStorage.setItem(LIVE_SCHEDULE_KEY, String(Date.now()))
  } catch {
    /* storage blocked */
  }
  window.dispatchEvent(new Event(LIVE_EVENT))
}

export function subscribeLiveSchedule(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === LIVE_SCHEDULE_KEY) onChange()
  }
  window.addEventListener(LIVE_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(LIVE_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

async function readExceptions(): Promise<Record<string, DayHours>> {
  const exceptions: Record<string, DayHours> = {}
  try {
    const rows = await read<ExceptionRow>('schedule_exceptions', 'date, closed, open, close')
    for (const row of rows) exceptions[String(row.date).slice(0, 10)] = dayHours(row)
  } catch {
    /* table not migrated yet: no one-off hours */
  }
  return exceptions
}

export async function loadPublicSchedule(): Promise<Schedule> {
  if (!supabase) return defaultSchedule
  const range = agendaRange()
  const [weekRows, blockRows, occupancy, exceptions] = await Promise.all([
    read<WeekRow>('schedule_week', 'weekday, closed, open, close'),
    readDates<BlockRow>('schedule_blocks_public', 'date, time', range.from, range.to),
    read<OccupancyRow>('booking_occupancy', 'start, minutes'),
    readExceptions(),
  ])
  const week = { ...defaultSchedule.week }
  for (const row of weekRows) {
    if (isWeekday(row.weekday)) week[row.weekday] = dayHours(row)
  }
  return {
    week,
    exceptions,
    blocks: blockRows.map(toBlock),
    bookings: occupancy.map((row) => ({
      start: localStart(String(row.start)),
      minutes: row.minutes,
    })),
  }
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
  | { type: 'blocks'; date: string; time: string; on: boolean; reason?: string; color?: string }
  | { type: 'week'; week: Record<Weekday, DayHours>; clearDates?: string[] }
  | { type: 'exception'; date: string; hours: DayHours | null }
  | { type: 'copyBlocks'; from: string; weeks: number; pattern: Partial<Record<Weekday, BlockPattern[]>> }

export type LoginResult = 'ok' | 'wrong' | 'unavailable'

function loginStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object' || !('context' in error)) return null
  const context = (error as { context?: { status?: unknown } }).context
  return typeof context?.status === 'number' ? context.status : null
}

/** Ask the edge function to check the password. Stores the session on success. */
export async function adminLogin(password: string): Promise<LoginResult> {
  if (!supabase) return 'unavailable'
  try {
    const { data, error } = await supabase.functions.invoke('admin-login', { body: { password } })
    if (!error) {
      const token =
        data && typeof data === 'object' && typeof (data as { token?: unknown }).token === 'string'
          ? (data as { token: string }).token
          : null
      storeAdminSession(token)
      return 'ok'
    }
    return loginStatus(error) === 401 ? 'wrong' : 'unavailable'
  } catch {
    return 'unavailable'
  }
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof Error && error.message === 'unauthorized'
}

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
  minutes: number
  kind: BookingKind
  status: 'confirmed' | 'pending' | 'declined'
  lang: Lang
  mail_sent: boolean
  /** Price stored when the booking was made; null for older bookings. */
  price: string | null
  /** Service price actually charged after a discount; null means the list price. */
  charged: number | null
  /** Products sold with this appointment. */
  items: OrderItem[]
}

export type ServiceSave = { id: ServiceId; price: string; minutes: number }

export type TemplateKey = MailKey
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
  minutes?: number | null
  kind: string
  status: string
  lang?: string | null
  mail_sent: boolean | null
  price?: string | null
  charged?: number | null
  items?: unknown
}

function toItems(value: unknown): OrderItem[] {
  if (!Array.isArray(value)) return []
  const items: OrderItem[] = []
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue
    const item = raw as Record<string, unknown>
    if (typeof item.name !== 'string') continue
    items.push({
      ...(typeof item.id === 'string' ? { id: item.id } : {}),
      productId: typeof item.productId === 'string' ? item.productId : null,
      name: item.name,
      listPrice: Number(item.listPrice) || 0,
      price: Number(item.price) || 0,
      quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
    })
  }
  return items
}

function isKind(value: string): value is BookingKind {
  return value === 'slot' || value === 'custom'
}

function isStatus(value: string): value is InboxRow['status'] {
  return value === 'confirmed' || value === 'pending' || value === 'declined'
}

function isTemplateKey(value: string): value is TemplateKey {
  return (MAIL_KEYS as string[]).includes(value)
}

function isLang(value: string): value is TemplateLang {
  return value === 'nl' || value === 'en'
}

function toInbox(rows: BookingRow[]): InboxRow[] {
  const inbox: InboxRow[] = []
  for (const row of rows) {
    if (!isServiceId(row.service) || !isKind(row.kind) || !isStatus(row.status)) continue
    const minutes = typeof row.minutes === 'number' && row.minutes > 0 ? row.minutes : SERVICE_MINUTES[row.service]
    inbox.push({
      id: String(row.id),
      service: row.service,
      name: row.name,
      email: row.email,
      phone: row.phone ?? '',
      start: localStart(String(row.start)),
      minutes,
      kind: row.kind,
      status: row.status,
      lang: row.lang === 'en' ? 'en' : 'nl',
      mail_sent: Boolean(row.mail_sent),
      price: typeof row.price === 'string' && row.price ? row.price : null,
      charged: typeof row.charged === 'number' && Number.isFinite(row.charged) ? row.charged : null,
      items: toItems(row.items),
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

export type ClientList = { ready: boolean; clients: ClientRecord[] }

function toClients(rows: unknown[]): ClientRecord[] {
  const clients: ClientRecord[] = []
  for (const item of rows) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    if (typeof row.id !== 'string' || typeof row.name !== 'string') continue
    clients.push({
      id: row.id,
      name: row.name,
      email: typeof row.email === 'string' ? row.email : '',
      phone: typeof row.phone === 'string' ? row.phone : '',
      note: typeof row.note === 'string' ? row.note : '',
      created_at: typeof row.created_at === 'string' ? row.created_at : '',
    })
  }
  return clients
}

/** Stored clients. `ready` is false until the clients table exists. */
export async function loadClients(): Promise<ClientList> {
  if (!supabase) throw new Error('offline')
  const { data, error } = await supabase.functions.invoke('clients-list', { body: {} })
  if (error) throw new Error(await invokeDetail(error))
  const failed = failurePayload(data)
  if (failed) throw new Error(failed)
  const record = (data ?? {}) as { ready?: unknown; clients?: unknown }
  return {
    ready: record.ready !== false,
    clients: Array.isArray(record.clients) ? toClients(record.clients) : [],
  }
}

export type ClientSave = { id?: string; name: string; email: string; phone: string; note: string }

export function saveClient(client: ClientSave) {
  return invokeOk('admin-write', { type: 'client', ...client })
}

export type MoveResult = { ok: true; sent: boolean } | { ok: false; error: string }

/** Move a booking to another moment (confirmed there) and mail the client. */
export async function moveBooking(id: string, start: string): Promise<MoveResult> {
  if (!supabase) return { ok: false, error: 'offline' }
  try {
    const { data, error } = await supabase.functions.invoke('booking-move', { body: { id, start } })
    const failed = failurePayload(data)
    if (failed) return { ok: false, error: failed }
    if (error) return { ok: false, error: await invokeDetail(error) }
    const sent = Boolean(data && typeof data === 'object' && (data as { sent?: unknown }).sent === true)
    return { ok: true, sent }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'offline' }
  }
}

/** Remove a client and all their bookings (for example after a privacy request). */
export function deleteClient(client: { id?: string | null; email: string; phone: string }) {
  return invokeOk('admin-write', {
    type: 'clientDelete',
    ...(client.id ? { id: client.id } : {}),
    email: client.email,
    phone: client.phone,
  })
}

/** Closed times with Bjorn's reasons and colours. Dashboard only (needs the session). */
export async function loadAdminBlocks(): Promise<ScheduleBlock[]> {
  if (!supabase) throw new Error('offline')
  const { data, error } = await supabase.functions.invoke('blocks-list', { body: {} })
  if (error) throw new Error(await invokeDetail(error))
  const failed = failurePayload(data)
  if (failed) throw new Error(failed)
  const record = (data ?? {}) as { blocks?: unknown }
  if (!Array.isArray(record.blocks)) throw new Error('offline')
  return (record.blocks as BlockRow[]).map(toBlock)
}

export type ProductList = { ready: boolean; products: Product[] }

/** Every product, with stock. `ready` is false until the products table exists. */
export async function loadProducts(): Promise<ProductList> {
  if (!supabase) throw new Error('offline')
  const { data, error } = await supabase.functions.invoke('products-list', { body: {} })
  if (error) throw new Error(await invokeDetail(error))
  const failed = failurePayload(data)
  if (failed) throw new Error(failed)
  const record = (data ?? {}) as { ready?: unknown; products?: unknown }
  const products: Product[] = []
  if (Array.isArray(record.products)) {
    for (const raw of record.products) {
      if (!raw || typeof raw !== 'object') continue
      const row = raw as Record<string, unknown>
      if (typeof row.id !== 'string' || typeof row.name !== 'string') continue
      products.push({
        id: row.id,
        name: row.name,
        price: Number(row.price) || 0,
        stock: Math.round(Number(row.stock) || 0),
        active: row.active !== false,
      })
    }
  }
  return { ready: record.ready !== false, products }
}

export type ProductSave = { id?: string; name: string; price: number; stock: number; active: boolean }

export function saveProduct(product: ProductSave) {
  return invokeOk('admin-write', { type: 'product', ...product })
}

/** What an appointment costs: service price after discount and the products sold. */
export function saveOrder(bookingId: string, order: { charged: number | null; items: OrderItem[] }) {
  return invokeOk('order-write', { id: bookingId, charged: order.charged, items: order.items })
}
