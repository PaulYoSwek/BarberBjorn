import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { todayIso, validateBooking, type BookingInput } from '../booking'
import { copy, type ServiceId } from '../content'
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
  firstBookableWeek,
  SERVICE_MINUTES,
  spanStarts,
  type AgendaDay,
  type BookingHold,
  type Schedule,
} from '../schedule'

const empty: BookingInput = { service: 'both', name: '', email: '', phone: '', slot: '', kind: 'slot' }
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
const WEEK = 7
/** How often the agenda re-reads the live schedule while it is on screen. */
const REFRESH_MS = 60_000

function monthIndex(date: string) {
  return Number(date.slice(5, 7)) - 1
}

function dayStamp(day: AgendaDay, labels: { key: string; label: string }[], short: string[]) {
  const name = labels.find((item) => item.key === day.weekday)?.label ?? day.weekday
  return `${name} ${Number(day.date.slice(8, 10))} ${short[monthIndex(day.date)]}`
}

function monthTitle(visible: AgendaDay[], months: string[]) {
  const first = monthIndex(visible[0].date)
  const last = monthIndex(visible[visible.length - 1].date)
  const year = visible[0].date.slice(0, 4)
  const yearEnd = visible[visible.length - 1].date.slice(0, 4)
  if (first === last && year === yearEnd) return `${months[first]} ${year}`
  if (year === yearEnd) return `${months[first]} – ${months[last]} ${year}`
  return `${months[first]} ${year} – ${months[last]} ${yearEnd}`
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
  const [customDate, setCustomDate] = useState('')
  const [customTime, setCustomTime] = useState('')
  const inputRef = useRef(input)
  inputRef.current = input
  const [week, setWeek] = useState(0)
  const [hover, setHover] = useState('')
  const [latched, setLatched] = useState(false)
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
        const next = { ...SERVICE_MINUTES }
        for (const row of rows) next[row.id] = row.minutes
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
  const days = useMemo(
    () => agendaDays(input.service, new Date(), agendaExtra),
    [input.service, agendaExtra],
  )
  const visible = days.slice(week * WEEK, week * WEEK + WEEK)
  const lastWeek = Math.ceil(days.length / WEEK) - 1

  useEffect(() => {
    setWeek((current) => {
      const page = days.slice(current * WEEK, current * WEEK + WEEK)
      const open = page.some((day) => !day.closed && day.slots.some((slot) => slot.fits && !slot.taken && !slot.past))
      return open ? current : firstBookableWeek(days, WEEK)
    })
  }, [days])

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
        const holdMinutes = minutes?.[input.service] ?? SERVICE_MINUTES[input.service]
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
  const duration = minutes?.[service] ?? SERVICE_MINUTES[service]
  const serviceName = t.services.find((item) => item.id === service)?.name ?? ''
  const when = whenStamp(input.slot, days, t.days, t.monthShort, duration)
  // The cells an appointment would cover: the chosen start, or the start under the pointer.
  const covered = new Set(input.kind === 'slot' && input.slot ? spanStarts(input.slot, duration) : [])
  const previewed = new Set(hover && hover !== input.slot ? spanStarts(hover, duration) : [])

  return (
    <section id="afspraak" className="booking">
      <form onSubmit={onSubmit}>
        <div className="booking-top">
          <p className="kicker">{t.bookKicker}</p>
          <h2>{t.bookTitle}</h2>
          <p>{t.bookIntro}</p>
          <div className="booking-services" role="group" aria-label={t.serviceLabel}>
            {t.services.map((item) => {
              const mins = minutes?.[item.id] ?? SERVICE_MINUTES[item.id]
              const on = input.service === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-label={item.name}
                  aria-pressed={on}
                  className={on ? 'is-on' : undefined}
                  onClick={() => setService(item.id)}
                >
                  {item.name}
                  <span aria-hidden="true">{mins} min</span>
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
              <div className="agenda-head">
                <h3 className="agenda-month">{visible.length > 0 ? monthTitle(visible, t.months) : ''}</h3>
                <div className="agenda-week">
                  <button type="button" aria-label={t.weekPrev} disabled={week === 0} onClick={() => setWeek((current) => current - 1)}>
                    ←
                  </button>
                  <button type="button" aria-label={t.weekNext} disabled={week >= lastWeek} onClick={() => setWeek((current) => current + 1)}>
                    →
                  </button>
                </div>
              </div>
              <div className="agenda">
              {visible.map((day) => {
                const label = dayStamp(day, t.days, t.monthShort)
                return (
                  <div key={day.date} className={day.closed ? 'agenda-day is-closed' : 'agenda-day'}>
                    <div className="agenda-when">
                      <strong>{label}</strong>
                      {day.closed && <span>{t.closedLabel}</span>}
                    </div>
                    {!day.closed && (
                      <div className="agenda-slots">
                        {day.slots.map((slot) => {
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
                          return (
                            <button
                              key={slot.start}
                              type="button"
                              aria-label={`${label} ${slot.time}`}
                              title={kind === 'is-nofit' ? (slot.fits ? t.noFitHint : t.noFitError) : undefined}
                              aria-pressed={on}
                              disabled={blocked}
                              className={
                                [on ? 'is-on' : undefined, inSpan ? 'is-span' : undefined, inPreview ? 'is-preview' : undefined, kind]
                                  .filter(Boolean)
                                  .join(' ') || undefined
                              }
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
                              {slot.time}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
              </div>
              <div className="agenda-week">
                <button type="button" onClick={chooseCustom}>{t.customTimeCta}</button>
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
