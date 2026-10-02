import { useEffect, useRef, useState, type FormEvent } from 'react'
import { mailtoHref, todayIso, validateBooking, type BookingInput } from '../booking'
import { CONTACT } from '../content'
import { useLang } from '../language'

const empty: BookingInput = { service: '', name: '', phone: '', day: '' }

export function BookingForm() {
  const { t } = useLang()
  const [input, setInput] = useState<BookingInput>(empty)
  const [errors, setErrors] = useState<Partial<Record<keyof BookingInput, string>>>({})
  const [fallback, setFallback] = useState('')
  const inputRef = useRef(input)
  inputRef.current = input

  useEffect(() => {
    setErrors((current) => {
      if (Object.keys(current).length === 0) return current
      const result = validateBooking(inputRef.current, t, todayIso())
      if (result.ok) return current
      return result.errors
    })
  }, [t])

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const result = validateBooking(input, t, todayIso())
    if (!result.ok) {
      setErrors(result.errors)
      setFallback('')
      return
    }
    setErrors({})
    const href = mailtoHref(CONTACT.email, result.subject, result.body)
    setFallback(`${t.mailFallback}\n${CONTACT.email}\n${result.body}`)
    window.location.assign(href)
  }

  return (
    <section id="afspraak" className="booking">
      <div>
        <p className="kicker">{t.bookKicker}</p>
        <h2>{t.bookTitle}</h2>
        <p>{t.bookIntro}</p>
      </div>
      <form onSubmit={onSubmit}>
        <label>
          {t.serviceLabel}
          <select
            value={input.service}
            onChange={(event) => setInput({ ...input, service: event.target.value as BookingInput['service'] })}
          >
            <option value="">{t.serviceLabel}</option>
            {t.services.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          {errors.service && <span role="alert">{errors.service}</span>}
        </label>
        <label>
          {t.nameLabel}
          <input value={input.name} onChange={(event) => setInput({ ...input, name: event.target.value })} />
          {errors.name && <span role="alert">{errors.name}</span>}
        </label>
        <label>
          {t.phoneLabel}
          <input value={input.phone} inputMode="tel" onChange={(event) => setInput({ ...input, phone: event.target.value })} />
          {errors.phone && <span role="alert">{errors.phone}</span>}
        </label>
        <label>
          {t.dayLabel}
          <input type="date" value={input.day} onChange={(event) => setInput({ ...input, day: event.target.value })} />
          {errors.day && <span role="alert">{errors.day}</span>}
        </label>
        <button type="submit">{t.sendLabel}</button>
        {fallback && <p role="alert">{fallback}</p>}
      </form>
    </section>
  )
}
