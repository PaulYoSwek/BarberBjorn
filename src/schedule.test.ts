import { expect, test } from 'vitest'
import { agendaDays, SERVICE_MINUTES } from './schedule'

const saturday = new Date('2026-10-03T11:00:00')

test('lists four weeks and keeps weekends closed', () => {
  const days = agendaDays('cut', saturday)
  expect(days).toHaveLength(28)
  expect(days[0].date).toBe('2026-10-03')
  expect(days[27].date).toBe('2026-10-30')
  expect(days[0].closed).toBe(true)
  expect(days[1].closed).toBe(true)
  expect(days[2].closed).toBe(false)
  expect(days[0].slots).toHaveLength(0)
  expect(days[23].date).toBe('2026-10-26')
  expect(days[23].closed).toBe(false)
})

test('only offers starts that still fit the service before close', () => {
  const cut = agendaDays('cut', saturday)[2]
  const beard = agendaDays('beard', saturday)[2]
  expect(SERVICE_MINUTES.cut).toBe(45)
  expect(SERVICE_MINUTES.beard).toBe(20)
  expect(cut.slots[0].time).toBe('09:00')
  expect(cut.slots.at(-1)?.time).toBe('17:00')
  expect(beard.slots.at(-1)?.time).toBe('17:30')
  expect(cut.slots.some((slot) => slot.time === '17:30')).toBe(false)
})

test('marks overlapping and past times so they stay visible but blocked', () => {
  const days = agendaDays('cut', saturday, {
    bookings: [{ start: '2026-10-05T10:00:00', minutes: 45 }],
  })
  const monday = days[2]
  const ten = monday.slots.find((slot) => slot.time === '10:00')
  const nine = monday.slots.find((slot) => slot.time === '09:30')
  const eleven = monday.slots.find((slot) => slot.time === '11:00')
  expect(ten?.taken).toBe(true)
  expect(nine?.taken).toBe(true)
  expect(eleven?.taken).toBe(false)

  const todayCut = agendaDays('cut', new Date('2026-10-05T12:10:00'))[0]
  expect(todayCut.date).toBe('2026-10-05')
  expect(todayCut.slots.find((slot) => slot.time === '09:00')?.past).toBe(true)
  expect(todayCut.slots.find((slot) => slot.time === '12:30')?.past).toBe(false)
})

test('a whole-day block closes that date only', () => {
  const days = agendaDays('cut', saturday, {
    blocks: [{ date: '2026-10-05' }],
  })
  expect(days[2].date).toBe('2026-10-05')
  expect(days[2].closed).toBe(true)
  expect(days[3].closed).toBe(false)
})

test('a half-hour block occupies that span for overlap', () => {
  const days = agendaDays('cut', saturday, {
    blocks: [{ date: '2026-10-05', time: '12:00' }],
  })
  const monday = days[2]
  expect(monday.slots.find((slot) => slot.time === '12:00')?.taken).toBe(true)
  expect(monday.slots.find((slot) => slot.time === '11:30')?.taken).toBe(true)
  expect(monday.slots.find((slot) => slot.time === '11:00')?.taken).toBe(false)
})

test('live minutes move the last bookable start', () => {
  const days = agendaDays('cut', saturday, { minutes: { cut: 60, beard: 20, both: 60 } })
  expect(days[2].slots.at(-1)?.time).toBe('17:00')
})

test('pending-only extra bookings are not used — only the bookings array occupies', () => {
  const days = agendaDays('cut', saturday, { bookings: [] })
  expect(days[2].slots.find((slot) => slot.time === '10:00')?.taken).toBe(false)
})
