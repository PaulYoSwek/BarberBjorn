import { useEffect, useMemo, useRef, useState } from 'react'
import { copy } from '../../content'
import { weekHoursFromDays } from '../../planning'
import { adminWrite, loadPublicSchedule, publishLiveSchedule, type InboxRow } from '../../planning-api'
import { agendaDays, defaultSchedule, type AgendaDay, type DayHours, type Schedule, type Weekday } from '../../schedule'
import { serviceName } from './admin-defaults'

const WEEK = 7
const DEFAULT_OPEN: DayHours = { open: '09:00', close: '18:00' }
const SAVE_FAILED = 'Opslaan mislukt. Controleer de verbinding en probeer het nog eens.'

function minutesOf(stamp: string): number {
  const [hours, minutes] = stamp.split(':').map(Number)
  return hours * 60 + minutes
}

function clock(minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0')
  const m = String(minutes % 60).padStart(2, '0')
  return `${h}:${m}`
}

function daySlotTimes(hours: DayHours): string[] {
  if ('closed' in hours) return []
  const open = minutesOf(hours.open)
  const close = minutesOf(hours.close)
  if (!Number.isFinite(open) || !Number.isFinite(close) || close < open) return []
  const times: string[] = []
  for (let start = open; start <= close; start += 30) times.push(clock(start))
  return times
}

function dayName(weekday: Weekday): string {
  return copy.nl.days.find((item) => item.key === weekday)?.label ?? weekday
}

function dayStamp(day: { date: string; weekday: Weekday }): string {
  const month = copy.nl.monthShort[Number(day.date.slice(5, 7)) - 1]
  return `${dayName(day.weekday)} ${Number(day.date.slice(8, 10))} ${month}`
}

function dayChip(day: { date: string; weekday: Weekday }, hours: DayHours): string {
  const span = 'closed' in hours ? 'dicht' : `${hours.open}–${hours.close}`
  return `${dayStamp(day)} ${span}`
}

function weekTitle(days: AgendaDay[]): string {
  if (days.length === 0) return ''
  const first = days[0]
  const last = days[days.length - 1]
  const a = `${Number(first.date.slice(8, 10))} ${copy.nl.monthShort[Number(first.date.slice(5, 7)) - 1]}`
  const b = `${Number(last.date.slice(8, 10))} ${copy.nl.monthShort[Number(last.date.slice(5, 7)) - 1]}`
  return `${a} – ${b}`
}

function booked(date: string, time: string, schedule: Schedule): boolean {
  const start = minutesOf(time)
  const end = start + 30
  return (schedule.bookings ?? []).some((hold) => {
    if (!hold.start.startsWith(date)) return false
    const holdStart = minutesOf(hold.start.slice(11, 16))
    return start < holdStart + hold.minutes && holdStart < end
  })
}

function blocked(date: string, time: string, schedule: Schedule): boolean {
  return (schedule.blocks ?? []).some((block) => block.date === date && block.time === time)
}

function blockKey(date: string, time: string): string {
  return `${date}|${time}`
}

/** Edits made on this device that are layered over whatever the cloud returned. */
type LocalEdits = {
  blocks: Map<string, boolean>
  exceptions: Map<string, DayHours | null>
  week: Record<Weekday, DayHours> | null
}

function withLocal(next: Schedule, local: LocalEdits): Schedule {
  let blocks = [...(next.blocks ?? [])]
  for (const [key, on] of local.blocks) {
    const split = key.indexOf('|')
    const date = key.slice(0, split)
    const time = key.slice(split + 1)
    blocks = blocks.filter((block) => !(block.date === date && (block.time ?? '') === time))
    if (on) blocks.push(time ? { date, time } : { date })
  }
  const exceptions = { ...(next.exceptions ?? {}) }
  for (const [date, hours] of local.exceptions) {
    if (hours) exceptions[date] = hours
    else delete exceptions[date]
  }
  return { ...next, blocks, exceptions, week: local.week ?? next.week }
}

function withClientHolds(schedule: Schedule, people: InboxRow[]): Schedule {
  const extra = people
    .filter((row) => row.status === 'confirmed')
    .map((row) => ({ start: row.start, minutes: row.minutes }))
  if (extra.length === 0) return schedule
  const bookings = [...(schedule.bookings ?? [])]
  const seen = new Set(bookings.map((item) => item.start))
  for (const hold of extra) {
    if (!seen.has(hold.start)) bookings.push(hold)
  }
  return { ...schedule, bookings }
}

function clientAt(date: string, time: string, people: InboxRow[]): InboxRow | undefined {
  const start = minutesOf(time)
  const end = start + 30
  return people.find((row) => {
    if (row.status !== 'confirmed') return false
    if (!row.start.startsWith(date)) return false
    const holdStart = minutesOf(row.start.slice(11, 16))
    return start < holdStart + row.minutes && holdStart < end
  })
}

function windowDays(now: Date, schedule: Schedule): AgendaDay[] {
  return agendaDays('cut', now, {
    week: schedule.week,
    exceptions: schedule.exceptions,
    blocks: schedule.blocks,
    bookings: schedule.bookings,
  })
}

const STATUS_LABEL: Record<InboxRow['status'], string> = {
  pending: 'In afwachting',
  confirmed: 'Bevestigd',
  declined: 'Geweigerd',
}

type Props = { clients?: InboxRow[] }

export function AdminAgenda({ clients = [] }: Props) {
  const people = clients
  const [cloud, setCloud] = useState<Schedule>(defaultSchedule)
  const [edition, setEdition] = useState(0)
  const [week, setWeek] = useState(0)
  const [picked, setPicked] = useState<string[]>([])
  const [ready, setReady] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [detail, setDetail] = useState<InboxRow | null>(null)
  const local = useRef<LocalEdits>({ blocks: new Map(), exceptions: new Map(), week: null })

  function touch() {
    setEdition((count) => count + 1)
  }

  useEffect(() => {
    let cancelled = false
    loadPublicSchedule()
      .then((next) => {
        if (cancelled) return
        setCloud(next)
        setReady(true)
      })
      .catch(() => {
        if (!cancelled) setNotice('Agenda laden mislukt.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // `edition` is part of the dependency list so local edits re-render the view.
  const view = useMemo(
    () => withLocal(withClientHolds(cloud, people), local.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cloud, people, edition],
  )
  const days = useMemo(() => windowDays(new Date(), view), [view])
  const visible = days.slice(week * WEEK, week * WEEK + WEEK)
  const lastWeek = Math.ceil(days.length / WEEK) - 1

  function hoursFor(day: { date: string; weekday: Weekday }): DayHours {
    if ((view.blocks ?? []).some((block) => block.date === day.date && !block.time)) {
      return { closed: true }
    }
    return view.exceptions?.[day.date] ?? view.week[day.weekday]
  }

  const fallback = visible.find((day) => !('closed' in hoursFor(day)))?.date ?? visible[0]?.date
  const selected = picked.filter((date) => visible.some((day) => day.date === date))
  const selectedDates = selected.length > 0 ? selected : fallback ? [fallback] : []
  const selectedDays = visible.filter((day) => selectedDates.includes(day.date))
  const hoursDay = selectedDays.find((day) => !('closed' in hoursFor(day))) ?? selectedDays[0]

  function saved(ok: boolean, revert: () => void) {
    if (ok) {
      setNotice(null)
      publishLiveSchedule()
      return
    }
    revert()
    touch()
    setNotice(SAVE_FAILED)
  }

  async function write(body: Parameters<typeof adminWrite>[0], revert: () => void) {
    try {
      const result = await adminWrite(body)
      saved(result.ok, revert)
    } catch {
      saved(false, revert)
    }
  }

  function toggle(date: string, time: string, on: boolean) {
    const key = blockKey(date, time)
    const before = local.current.blocks.get(key)
    local.current.blocks.set(key, on)
    touch()
    void write({ type: 'blocks', date, time, on }, () => {
      if (before === undefined) local.current.blocks.delete(key)
      else local.current.blocks.set(key, before)
    })
  }

  function closeDay(date: string, weekday: Weekday, on: boolean) {
    if (!ready) return
    const key = blockKey(date, '')
    const beforeBlock = local.current.blocks.get(key)
    const beforeException = local.current.exceptions.get(date)
    local.current.blocks.set(key, on)
    // Reopening a day whose template or one-off hours say "closed" needs real hours.
    const underlying = view.exceptions?.[date] ?? view.week[weekday]
    const needsHours = !on && 'closed' in underlying
    if (needsHours) local.current.exceptions.set(date, DEFAULT_OPEN)
    setPicked((current) => {
      const inView = current.filter((item) => visible.some((row) => row.date === item))
      return inView.includes(date) ? inView : [...inView, date]
    })
    touch()
    const revert = () => {
      if (beforeBlock === undefined) local.current.blocks.delete(key)
      else local.current.blocks.set(key, beforeBlock)
      if (needsHours) {
        if (beforeException === undefined) local.current.exceptions.delete(date)
        else local.current.exceptions.set(date, beforeException)
      }
    }
    void (async () => {
      try {
        const first = await adminWrite({ type: 'blocks', date, time: '', on })
        if (!first.ok) return saved(false, revert)
        if (needsHours) {
          const second = await adminWrite({ type: 'exception', date, hours: DEFAULT_OPEN })
          return saved(second.ok, revert)
        }
        saved(true, revert)
      } catch {
        saved(false, revert)
      }
    })()
  }

  /** One-off hours for every selected day. The weekday template stays as it is. */
  function remember(next: DayHours) {
    if (!ready || selectedDates.length === 0) return
    const before = new Map(selectedDates.map((date) => [date, local.current.exceptions.get(date)] as const))
    for (const date of selectedDates) local.current.exceptions.set(date, next)
    touch()
    const revert = () => {
      for (const [date, hours] of before) {
        if (hours === undefined) local.current.exceptions.delete(date)
        else local.current.exceptions.set(date, hours)
      }
    }
    void (async () => {
      try {
        const results = await Promise.all(
          selectedDates.map((date) => adminWrite({ type: 'exception', date, hours: next })),
        )
        saved(results.every((result) => result.ok), revert)
      } catch {
        saved(false, revert)
      }
    })()
  }

  /** The viewed week becomes the repeating Monday–Sunday template. */
  function apply() {
    if (!ready || visible.length === 0) return
    const pageDates = visible.map((day) => day.date)
    const next = weekHoursFromDays(visible.map((day) => ({ weekday: day.weekday, hours: hoursFor(day) })))
    const beforeWeek = local.current.week
    const beforeExceptions = new Map(pageDates.map((date) => [date, local.current.exceptions.get(date)] as const))
    local.current.week = next
    for (const date of pageDates) local.current.exceptions.set(date, null)
    touch()
    void write({ type: 'week', week: next, clearDates: pageDates }, () => {
      local.current.week = beforeWeek
      for (const [date, hours] of beforeExceptions) {
        if (hours === undefined) local.current.exceptions.delete(date)
        else local.current.exceptions.set(date, hours)
      }
    })
  }

  const hours = hoursDay ? hoursFor(hoursDay) : null

  function slotState(date: string, time: string): 'booked' | 'shut' | 'vrij' {
    if (booked(date, time, view)) return 'booked'
    if (blocked(date, time, view)) return 'shut'
    return 'vrij'
  }

  function togglePick(date: string) {
    setPicked((current) => {
      const inView = current.filter((item) => visible.some((day) => day.date === item))
      const basis = inView.length > 0 ? inView : fallback ? [fallback] : []
      if (basis.includes(date)) {
        return basis.length === 1 ? basis : basis.filter((item) => item !== date)
      }
      return [...basis, date]
    })
  }

  return (
    <div className="admin-agenda">
      <header className="admin-agenda-head">
        <div>
          <p className="admin-kicker">Planning</p>
          <h1>Weekoverzicht</h1>
        </div>
        <ul className="admin-legend">
          <li className="is-vrij">vrij</li>
          <li className="is-shut">dicht</li>
          <li className="is-booked">geboekt</li>
        </ul>
      </header>
      <div className="admin-toolbar">
        <div className="admin-week">
          <button type="button" disabled={week === 0} onClick={() => setWeek((current) => current - 1)}>
            Vorige week
          </button>
          <p className="admin-week-title">{weekTitle(visible)}</p>
          <button type="button" disabled={week >= lastWeek} onClick={() => setWeek((current) => current + 1)}>
            Volgende week
          </button>
        </div>
        {hoursDay && hours ? (
          <section className="admin-hours">
            <p className="admin-hours-title">Opening {selectedDays.map((day) => dayStamp(day)).join(', ')}</p>
            <div className="admin-hours-row">
              {'closed' in hours ? (
                <p className="admin-hours-closed">Deze dag is dicht. Zet hem open in de kolom.</p>
              ) : (
                <>
                  <label>
                    Open
                    <input
                      type="time"
                      value={hours.open}
                      disabled={!ready}
                      onChange={(event) => remember({ open: event.target.value, close: hours.close })}
                    />
                  </label>
                  <label>
                    Sluit
                    <input
                      type="time"
                      value={hours.close}
                      disabled={!ready}
                      onChange={(event) => remember({ open: hours.open, close: event.target.value })}
                    />
                  </label>
                </>
              )}
            </div>
          </section>
        ) : null}
        <button type="button" className="admin-copy-week" disabled={!ready} onClick={apply}>
          Kopieer naar aankomende weken
        </button>
      </div>
      <p className="admin-hint">
        Tik dagen aan om ze samen in te stellen. Uren gelden alleen voor die dag. Kopieer naar aankomende weken zet
        deze week als vaste standaard. Geboekt opent de klant.
      </p>
      {!ready && !notice ? <p className="admin-hint">Agenda laden…</p> : null}
      {notice ? <p role="alert">{notice}</p> : null}
      {detail ? (
        <div className="admin-booking" role="dialog" aria-label="Boeking">
          <p className="admin-kicker">Boeking</p>
          <h2>{detail.name}</h2>
          <p>
            {serviceName(detail.service)} · {detail.minutes} min
          </p>
          <p>
            <a href={`mailto:${detail.email}`}>{detail.email}</a>
          </p>
          {detail.phone ? (
            <p>
              <a href={`tel:${detail.phone.replace(/\s+/g, '')}`}>{detail.phone}</a>
            </p>
          ) : null}
          <p>
            {detail.start.slice(0, 10)} {detail.start.slice(11, 16)}
          </p>
          <p>{STATUS_LABEL[detail.status]}</p>
          <p>{detail.kind === 'custom' ? 'Ander tijdstip' : 'Slot'}</p>
          {detail.mail_sent ? null : <p>Mail niet gegaan</p>}
          <button type="button" onClick={() => setDetail(null)}>
            Sluiten
          </button>
        </div>
      ) : null}
      <div className="agenda admin-week-grid">
        {visible.map((day) => {
          const dayHours = hoursFor(day)
          const closed = 'closed' in dayHours
          const stamp = dayStamp(day)
          return (
            <div
              key={day.date}
              className={`agenda-day admin-col${closed ? ' is-closed' : ''}${selectedDates.includes(day.date) ? ' is-on' : ''}`}
            >
              <button
                type="button"
                className="agenda-when admin-col-head"
                aria-pressed={selectedDates.includes(day.date)}
                aria-label={dayChip(day, dayHours)}
                onClick={() => togglePick(day.date)}
              >
                <strong>{stamp}</strong>
                <span>{closed ? 'dicht' : `${dayHours.open}–${dayHours.close}`}</span>
              </button>
              <button
                type="button"
                className={`admin-day-toggle${closed ? ' is-on' : ''}`}
                aria-pressed={closed}
                aria-label={`${stamp} hele dag dicht`}
                disabled={!ready}
                onClick={() => closeDay(day.date, day.weekday, !closed)}
              >
                Dag dicht
              </button>
              {!closed ? (
                <div className="agenda-slots admin-col-slots">
                  {daySlotTimes(dayHours).map((time) => {
                    const state = slotState(day.date, time)
                    const client = state === 'booked' ? clientAt(day.date, time, people) : undefined
                    const label = state === 'booked' ? 'geboekt' : state === 'shut' ? 'dicht' : 'vrij'
                    const who = client ? ` ${client.name}` : ''
                    return (
                      <button
                        key={time}
                        type="button"
                        className={`admin-cell is-${state}`}
                        aria-pressed={state === 'shut'}
                        aria-label={`${stamp} ${time} ${label}${who}`}
                        onClick={() => {
                          if (state === 'booked') {
                            if (client) setDetail(client)
                            return
                          }
                          toggle(day.date, time, state !== 'shut')
                        }}
                      >
                        <span>{time}</span>
                        {client ? <span className="admin-cell-name">{client.name}</span> : <span>{label}</span>}
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
