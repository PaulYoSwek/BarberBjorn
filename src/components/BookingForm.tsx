import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { todayIso, validateBooking, type BookingInput } from '../booking'
import { copy, type ServiceId } from '../content'
import { completeService, offered, SEED_SERVICES, setServiceCatalog, type ServiceInfo } from '../service-catalog'
import { useLang } from '../language'
import { setOpeningHours } from '../seo'
import {
  loadPublicSchedule,
  loadServices,
  subscribeLiveSchedule,
  submitBook,
  submitCustom,
} from '../planning-api'
import {
  agendaDays,
  defaultSchedule,
  firstBookableDate,
  hasFreeStart,
  monthOf,
  DEFAULT_MINUTES,
  SERVICE_MINUTES,
  spanStarts,
  type AgendaDay,
  type BookingHold,
  type MonthCell,
  type Schedule,
} from '../schedule'
import { MonthCalendar } from './MonthCalendar'
import { axisOf, blockStyle, TimeGrid, type GridColumn } from './TimeGrid'

const empty: BookingInput = { service: 'both', name: '', email: '', phone: '', slot: '', kind: 'slot' }
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
const MONDAY_FIRST = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
/** How often the agenda re-reads the live schedule while it is on screen. */
const REFRESH_MS = 60_000
/** Height of an hour in the agenda: a quarter-hour is a comfortable tap. */
const PX_PER_HOUR = 96
const NARROW = '(max-width: 800px)'

function monthIndex(date: string) {
  return Number(date.slice(5, 7)) - 1
}

function dayStamp(day: AgendaDay, labels: { key: string; label: string }[], short: string[]) {
  const name = labels.find((item) => item.key === day.weekday)?.label ?? day.weekday
  return `${name} ${Number(day.date.slice(8, 10))} ${short[monthIndex(day.date)]}`
}

function customSlot(date: string, time: string) {
  if (!date || !time) return ''
  return `${date}T${time.slice(0, 5)}:00`
}

function endClock(time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(Number)
  const total = hours * 60 + mins + minutes
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function whenStamp(
  slot: string,
  days: AgendaDay[],
  labels: { key: string; label: string }[],
  short: string[],
  minutes: number,
) {
  if (!slot) return ''
  const date = slot.slice(0, 10)
  const time = slot.slice(11, 16)
  const span = minutes > 0 ? `${time}–${endClock(time, minutes)}` : time
  const day = days.find((item) => item.date === date)
  if (day) return `${dayStamp(day, labels, short)} ${span}`
  const weekday = WEEKDAYS[new Date(`${date}T12:00:00`).getDay()]
  const name = labels.find((item) => item.key === weekday)?.label ?? weekday
  return `${name} ${Number(date.slice(8, 10))} ${short[monthIndex(date)]} ${span}`
}

const TAKEN_SIGNALS = new Set(['taken', 'takenError', copy.nl.takenError, copy.en.takenError])

function withSessionHolds(loaded: Schedule, holds: BookingHold[]): Schedule {
  if (holds.length === 0) return loaded
  const bookings = loaded.bookings ?? []
  const seen = new Set(bookings.map((item) => item.start))
  const extra = holds.filter((item) => !seen.has(item.start))
  if (extra.length === 0) return loaded
  return { ...loaded, bookings: [...bookings, ...extra] }
}

function shownSubmitError(error: string, taken: string) {
  return TAKEN_SIGNALS.has(error) ? taken : error
}

export function BookingForm() {
  const { t, lang } = useLang()
  const [input, setInput] = useState<BookingInput>(empty)
  const [errors, setErrors] = useState<Partial<Record<keyof BookingInput, string>>>({})
  const [status, setStatus] = useState<'book' | 'request' | ''>('')
  const [submitError, setSubmitError] = useState('')
  const [schedule, setSchedule] = useState<Schedule>(defaultSchedule)
  const [minutes, setMinutes] = useState<Record<ServiceId, number> | null>(null)
  const [services, setServices] = useState<ServiceInfo[]>(SEED_SERVICES)
  const [customDate, setCustomDate] = useState('')
  const [customTime, setCustomTime] = useState('')
  const inputRef = useRef(input)
  inputRef.current = input
  /** The day whose times are shown; empty means "the first day with a free time". */
  const [pickedDate, setPickedDate] = useState('')
  /** The month on screen; null follows the picked day. */
  const [viewMonth, setViewMonth] = useState<{ year: number; month: number } | null>(null)
  const [hover, setHover] = useState('')
  // Phones show one day at a time; wider screens the whole week.
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW).matches)
  const [latched, setLatched] = useState(false)

  useEffect(() => {
    const query = window.matchMedia(NARROW)
    const onChange = () => setNarrow(query.matches)
    query.addEventListener?.('change', onChange)
    return () => query.removeEventListener?.('change', onChange)
  }, [])
  const busy = useRef(false)
  const [sending, setSending] = useState(false)
  const sessionHolds = useRef<BookingHold[]>([])
  const refreshRef = useRef<() => void>(() => {})

  const edit = (next: BookingInput) => {
    setLatched(false)
    setInput(next)
  }

  useEffect(() => {
    let cancelled = false
    let generation = 0
    function refresh() {
      const mine = ++generation
      loadPublicSchedule()
        .then((next) => {
          if (cancelled || mine !== generation) return
          setSchedule(withSessionHolds(next, sessionHolds.current))
          setOpeningHours(next.week)
        })
        .catch(() => {})
    }
    refreshRef.current = refresh
    refresh()
    // Another tab on this device (the dashboard) changed something.
    const stop = subscribeLiveSchedule(refresh)
    // Coming back to the tab or window: someone else may have booked, or the dashboard closed a time.
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    // And every minute while the page is open, for a dashboard on another device.
    const timer = window.setInterval(onVisible, REFRESH_MS)
    loadServices()
      .then((rows) => {
        if (cancelled || rows.length === 0) return
        const next: Record<ServiceId, number> = {}
        for (const row of rows) next[row.id] = row.minutes
        setServiceCatalog(rows)
        setServices(rows.map(completeService))
        setMinutes(next)
      })
      .catch(() => {})
    return () => {
      cancelled = true
      stop()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.clearInterval(timer)
    }
  }, [])

  const agendaExtra = useMemo(
    () => ({
      week: schedule.week,
      exceptions: schedule.exceptions,
      blocks: schedule.blocks,
      bookings: schedule.bookings,
      ...(minutes ? { minutes } : {}),
    }),
    [schedule, minutes],
  )
  const choices = useMemo(() => offered(services), [services])

  // The chosen service was hidden or removed in the dashboard: fall back to one that is offered.
  useEffect(() => {
    if (choices.length === 0 || choices.some((item) => item.id === input.service)) return
    const next = choices.find((item) => item.id === 'both') ?? choices[0]
    setInput((current) => ({ ...current, service: next.id, slot: current.kind === 'slot' ? '' : current.slot }))
  }, [choices, input.service])

  const days = useMemo(
    () => agendaDays(input.service, new Date(), agendaExtra),
    [input.service, agendaExtra],
  )
  const byDate = useMemo(() => new Map(days.map((day) => [day.date, day])), [days])
  // A picked day that lost its last free time (someone booked, hours changed) falls back to the first free one.
  // The day in focus: the one tapped in the month, else the first with a free time.
  const picked = byDate.has(pickedDate) ? pickedDate : (firstBookableDate(days) ?? days[0].date)
  const focusIndex = Math.max(0, days.findIndex((day) => day.date === picked))
  const weekDays = days.slice(Math.floor(focusIndex / 7) * 7, Math.floor(focusIndex / 7) * 7 + 7)
  const shownDays = narrow ? [days[focusIndex]] : weekDays
  const canBack = narrow ? focusIndex > 0 : focusIndex >= 7
  const canForward = narrow ? focusIndex < days.length - 1 : Math.floor(focusIndex / 7) < Math.floor((days.length - 1) / 7)
  const shiftFocus = (step: number) => {
    const next = days[Math.min(days.length - 1, Math.max(0, focusIndex + step * (narrow ? 1 : 7)))]
    setPickedDate(next.date)
    setViewMonth(null)
  }
  const firstMonth = monthOf(days[0].date)
  const lastMonth = monthOf(days[days.length - 1].date)
  const shownMonth = viewMonth ?? monthOf(picked || days[0].date)
  const monthNumber = (value: { year: number; month: number }) => value.year * 12 + value.month
  const canPrev = monthNumber(shownMonth) > monthNumber(firstMonth)
  const canNext = monthNumber(shownMonth) < monthNumber(lastMonth)
  const shiftMonth = (step: number) => {
    const total = monthNumber(shownMonth) + step
    setViewMonth({ year: Math.floor(total / 12), month: total % 12 })
  }
  const todayDate = todayIso()
  const weekdayLabels = MONDAY_FIRST.map((key) => t.days.find((item) => item.key === key)?.label ?? key)

  // A chosen start that no longer fits (someone else booked, hours changed) is let go.
  useEffect(() => {
    if (input.kind !== 'slot' || !input.slot) return
    const day = days.find((item) => item.date === input.slot.slice(0, 10))
    const found = day?.slots.find((item) => item.start === input.slot)
    if (!found || !found.fits || found.taken || found.past) {
      setInput((current) => (current.slot === input.slot ? { ...current, slot: '' } : current))
    }
  }, [days, input.kind, input.slot])

  useEffect(() => {
    setErrors((current) => {
      if (Object.keys(current).length === 0) return current
      const result = validateBooking(inputRef.current, t, todayIso(), new Date(), agendaExtra)
      if (result.ok) return current
      return result.errors
    })
  }, [t, agendaExtra])

  const chooseCustom = () => {
    setCustomDate('')
    setCustomTime('')
    edit({ ...input, kind: 'custom', slot: '' })
  }

  const setCustom = (date: string, time: string) => {
    setCustomDate(date)
    setCustomTime(time)
    edit({ ...input, kind: 'custom', slot: customSlot(date, time) })
  }

  const setService = (next: ServiceId) => {
    edit({ ...input, service: next, slot: input.kind === 'slot' ? '' : input.slot })
  }

  const backToAgenda = () => {
    setCustomDate('')
    setCustomTime('')
    edit({ ...input, kind: 'slot', slot: '' })
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy.current || latched) return
    const result = validateBooking(input, t, todayIso(), new Date(), agendaExtra)
    if (!result.ok) {
      setErrors(result.errors)
      setStatus('')
      setSubmitError('')
      return
    }
    busy.current = true
    setSending(true)
    setErrors({})
    const payload = { ...input, lang }
    try {
      const sent = input.kind === 'custom' ? await submitCustom(payload) : await submitBook(payload)
      if (!sent.ok) {
        setStatus('')
        setSubmitError(sent.error)
        // The grid is stale when the time was just taken: show the real state.
        if (TAKEN_SIGNALS.has(sent.error)) refreshRef.current()
        return
      }
      setSubmitError('')
      setStatus(input.kind === 'custom' ? 'request' : 'book')
      setLatched(true)
      if (input.kind === 'slot' && input.service) {
        const holdMinutes = minutes?.[input.service] ?? SERVICE_MINUTES[input.service] ?? DEFAULT_MINUTES
        const hold = { start: input.slot, minutes: holdMinutes }
        sessionHolds.current = [...sessionHolds.current, hold]
        setSchedule((current) => ({
          ...current,
          bookings: [...(current.bookings ?? []), hold],
        }))
        setInput((current) => ({ ...current, slot: '' }))
      }
    } finally {
      busy.current = false
      setSending(false)
    }
  }

  const service = input.service || 'both'
  const duration = minutes?.[service] ?? SERVICE_MINUTES[service] ?? DEFAULT_MINUTES
  const serviceName = choices.find((item) => item.id === service)?.name[lang] ?? ''
  const when = whenStamp(input.slot, days, t.days, t.monthShort, duration)
  // The cells an appointment would cover: the chosen start, or the start under the pointer.
  const covered = new Set(input.kind === 'slot' && input.slot ? spanStarts(input.slot, duration) : [])
  const previewed = new Set(hover && hover !== input.slot ? spanStarts(hover, duration) : [])

  const dayHours = (day: AgendaDay) =>
    day.closed || day.slots.length === 0
      ? undefined
      : { open: day.slots[0].time, close: endClock(day.slots[day.slots.length - 1].time, 15) }
  const axis = axisOf(shownDays.map((day) => ({ hours: dayHours(day) })))
  const gridColumns: GridColumn[] = shownDays.map((day) => {
    const label = dayStamp(day, t.days, t.monthShort)
    const weekday = t.days.find((item) => item.key === day.weekday)?.label ?? day.weekday
    return {
      key: day.date,
      className: day.date === todayDate ? 'is-today' : undefined,
      hours: dayHours(day),
      header: (
        <>
          <span className="tg-day">{weekday}</span>
          <strong className="tg-num">{Number(day.date.slice(8, 10))}</strong>
        </>
      ),
      children: day.slots.map((slot) => {
        const blocked = !slot.fits || slot.taken || slot.past
        const on = input.slot === slot.start
        const inSpan = !on && covered.has(slot.start)
        const inPreview = !on && !inSpan && previewed.has(slot.start)
        // Black only where the dashboard shows closed or booked; a start that is open
        // but too short for the chosen service is greyed out like a past time.
        const kind = slot.past
          ? 'is-past'
          : slot.held
            ? 'is-taken'
            : slot.taken || !slot.fits
              ? 'is-nofit'
              : undefined
        const text = on
          ? `${slot.time}–${endClock(slot.time, duration)}`
          : slot.start === hover && !blocked
            ? `${slot.time}–${endClock(slot.time, duration)}`
            : ''
        return (
          <button
            key={slot.start}
            type="button"
            aria-label={`${label} ${slot.time}`}
            title={kind === 'is-nofit' ? (slot.fits ? t.noFitHint : t.noFitError) : undefined}
            aria-pressed={on}
            disabled={blocked}
            className={
              ['tg-cell', on ? 'is-on' : undefined, inSpan ? 'is-span' : undefined, inPreview ? 'is-preview' : undefined, kind]
                .filter(Boolean)
                .join(' ')
            }
            style={blockStyle(slot.time, 15, axis.start, PX_PER_HOUR)}
            onMouseEnter={() => {
              if (!blocked) setHover(slot.start)
            }}
            onMouseLeave={() => setHover('')}
            onFocus={() => {
              if (!blocked) setHover(slot.start)
            }}
            onBlur={() => setHover('')}
            onClick={() => edit({ ...input, slot: slot.start })}
          >
            {text}
          </button>
        )
      }),
    }
  })

  return (
    <section id="afspraak" className="booking">
      <form onSubmit={onSubmit}>
        <div className="booking-top">
          <p className="kicker">{t.bookKicker}</p>
          <h2>{t.bookTitle}</h2>
          <p>{t.bookIntro}</p>
          <div
            className="booking-services"
            role="group"
            aria-label={t.serviceLabel}
            style={{ '--service-cols': choices.length === 4 ? 2 : Math.min(3, Math.max(1, choices.length)) } as CSSProperties}
          >
            {choices.map((item) => {
              const mins = minutes?.[item.id] ?? item.minutes
              const on = input.service === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={on}
                  className={on ? 'is-on' : undefined}
                  onClick={() => setService(item.id)}
                >
                  {item.name[lang]}{' '}
                  <span>{mins} min</span>
                </button>
              )
            })}
          </div>
        </div>
        <div className="agenda-wrap">
          {input.kind === 'custom' ? (
            <div className="booking-fields">
              <button type="button" onClick={backToAgenda}>{t.backToAgenda}</button>
              <h3>{t.customTimeTitle}</h3>
              <label>
                {t.dayLabel}
                <input
                  type="date"
                  value={customDate}
                  onChange={(event) => setCustom(event.target.value, customTime)}
                />
              </label>
              <label>
                {t.slotLabel}
                <input
                  type="time"
                  value={customTime}
                  onChange={(event) => setCustom(customDate, event.target.value)}
                />
              </label>
            </div>
          ) : (
            <>
              <div className="agenda-layout">
                <aside className="agenda-mini">
                  <MonthCalendar
                    className="cal-mini"
                    year={shownMonth.year}
                    month={shownMonth.month}
                    title={`${t.months[shownMonth.month]} ${shownMonth.year}`}
                    weekdayLabels={weekdayLabels}
                    prevLabel={t.monthPrev}
                    nextLabel={t.monthNext}
                    canPrev={canPrev}
                    canNext={canNext}
                    onPrev={() => shiftMonth(-1)}
                    onNext={() => shiftMonth(1)}
                    renderDay={(cell: MonthCell) => {
                      const day = byDate.get(cell.date)
                      const free = day ? hasFreeStart(day) : false
                      const label = day
                        ? dayStamp(day, t.days, t.monthShort)
                        : `${Number(cell.date.slice(8, 10))} ${t.monthShort[monthIndex(cell.date)]}`
                      const past = cell.date < todayDate
                      const classes = [
                        'cal-day',
                        cell.date === picked ? 'is-on' : undefined,
                        cell.date === todayDate ? 'is-today' : undefined,
                        day?.closed ? 'is-closed' : undefined,
                        past || !day ? 'is-past' : undefined,
                      ]
                        .filter(Boolean)
                        .join(' ')
                      return (
                        <button
                          type="button"
                          className={classes}
                          aria-label={label}
                          aria-pressed={cell.date === picked}
                          disabled={!free}
                          onClick={() => {
                            setPickedDate(cell.date)
                            setViewMonth(null)
                          }}
                        >
                          <span>{Number(cell.date.slice(8, 10))}</span>
                          {free ? <i className="cal-dot" aria-hidden="true" /> : null}
                        </button>
                      )
                    }}
                  />
                  <p className="cal-legend">
                    <i className="cal-dot" aria-hidden="true" /> {t.freeLegend} · {t.pickDayHint}
                  </p>
                </aside>
                <div className="agenda-main">
                  <div className="agenda-bar">
                    <div className="agenda-week">
                      <button type="button" aria-label={narrow ? t.dayPrev : t.weekPrev} disabled={!canBack} onClick={() => shiftFocus(-1)}>
                        ←
                      </button>
                      <button type="button" aria-label={narrow ? t.dayNext : t.weekNext} disabled={!canForward} onClick={() => shiftFocus(1)}>
                        →
                      </button>
                    </div>
                    <h4 className="agenda-range">
                      {shownDays.length === 1
                        ? dayStamp(shownDays[0], t.days, t.monthShort)
                        : `${dayStamp(shownDays[0], t.days, t.monthShort)} – ${dayStamp(shownDays[shownDays.length - 1], t.days, t.monthShort)}`}
                    </h4>
                    <button type="button" className="agenda-custom" onClick={chooseCustom}>
                      {t.customTimeCta}
                    </button>
                  </div>
                  <div className="tg-scroll">
                    <TimeGrid
                      columns={gridColumns}
                      axisStart={axis.start}
                      axisEnd={axis.end}
                      pxPerHour={PX_PER_HOUR}
                      closedLabel={t.closedLabel}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
          {errors.slot && <span role="alert">{errors.slot}</span>}
        </div>
        <div className="booking-fields">
          <label>
            {t.nameLabel}
            <input value={input.name} autoComplete="name" onChange={(event) => edit({ ...input, name: event.target.value })} />
            {errors.name && <span role="alert">{errors.name}</span>}
          </label>
          <label>
            {t.emailLabel}
            <input type="email" value={input.email} autoComplete="email" onChange={(event) => edit({ ...input, email: event.target.value })} />
            {errors.email && <span role="alert">{errors.email}</span>}
          </label>
          <label>
            {t.phoneLabel}
            <input value={input.phone} type="tel" inputMode="tel" autoComplete="tel" onChange={(event) => edit({ ...input, phone: event.target.value })} />
            {errors.phone && <span role="alert">{errors.phone}</span>}
          </label>
        </div>
        <div className="booking-confirm">
          <p className="booking-summary" data-testid="booking-summary">
            <span>{serviceName}{duration > 0 ? ` · ${duration} min` : ''}</span>
            <strong>{when || t.noTimeYet}</strong>
          </p>
          <button type="submit" disabled={sending} aria-busy={sending}>
            {sending ? t.sendingLabel : t.sendLabel}
          </button>
        </div>
        <p className="booking-privacy">
          {t.privacyNote}{' '}
          <a href={lang === 'en' ? '/privacy?lang=en' : '/privacy'}>{t.privacyLink}</a>
        </p>
        {status === 'book' && <p>{t.bookSuccess}</p>}
        {status === 'request' && <p>{t.requestSuccess}</p>}
        {submitError && <p role="alert">{shownSubmitError(submitError, t.takenError)}</p>}
      </form>
    </section>
  )
}
