import { expect, test } from 'vitest'
import { agendaDays, SERVICE_MINUTES, SLOT_MINUTES, spanCells, spanStarts } from './schedule'

const saturday = new Date('2026-10-03T11:00:00')

test('lists four weeks from Monday and keeps Sunday last', () => {
  const days = agendaDays('cut', saturday)
  expect(days).toHaveLength(28)
  expect(days[0].date).toBe('2026-09-28')
  expect(days[0].weekday).toBe('mon')
  expect(days[6].date).toBe('2026-10-04')
  expect(days[6].weekday).toBe('sun')
  expect(days[27].date).toBe('2026-10-25')
  expect(days[5].closed).toBe(true)
  expect(days[6].closed).toBe(true)
  expect(days[7].closed).toBe(false)
  expect(days[5].slots).toHaveLength(0)
  expect(days[21].date).toBe('2026-10-19')
  expect(days[21].closed).toBe(false)
})

test('only offers starts that still fit the service before close', () => {
  const cut = agendaDays('cut', saturday)[7]
  const beard = agendaDays('beard', saturday)[7]
  expect(SERVICE_MINUTES).toEqual({ cut: 45, beard: 30, both: 75 })
  expect(SLOT_MINUTES).toBe(15)
  expect(cut.slots[0].time).toBe('09:00')
  expect(cut.slots[1].time).toBe('09:15')
  expect(cut.slots.at(-1)?.time).toBe('17:15')
  expect(beard.slots.at(-1)?.time).toBe('17:30')
  expect(cut.slots.some((slot) => slot.time === '17:30')).toBe(false)
  const both = agendaDays('both', saturday)[7]
  expect(both.slots.at(-1)?.time).toBe('16:45')
  expect(both.slots).toHaveLength(32)
})

test('marks overlapping and past times so they stay visible but blocked', () => {
  const days = agendaDays('cut', saturday, {
    bookings: [{ start: '2026-10-05T10:00:00', minutes: 45 }],
  })
  const monday = days[7]
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
  expect(days[7].date).toBe('2026-10-05')
  expect(days[7].closed).toBe(true)
  expect(days[8].closed).toBe(false)
})

test('a half-hour block occupies that span for overlap', () => {
  const days = agendaDays('cut', saturday, {
    blocks: [{ date: '2026-10-05', time: '12:00' }],
  })
  const monday = days[7]
  expect(monday.slots.find((slot) => slot.time === '12:00')?.taken).toBe(true)
  expect(monday.slots.find((slot) => slot.time === '11:30')?.taken).toBe(true)
  expect(monday.slots.find((slot) => slot.time === '11:00')?.taken).toBe(false)
})

test('live minutes move the last bookable start', () => {
  const days = agendaDays('cut', saturday, { minutes: { cut: 90, beard: 20, both: 60 } })
  expect(days[7].slots.at(-1)?.time).toBe('16:30')
})

test('pending-only extra bookings are not used — only the bookings array occupies', () => {
  const days = agendaDays('cut', saturday, { bookings: [] })
  expect(days[7].slots.find((slot) => slot.time === '10:00')?.taken).toBe(false)
})

test('a start that runs into a closed half-hour is not bookable but is not itself held', () => {
  const days = agendaDays('both', saturday, {
    blocks: [
      { date: '2026-10-05', time: '10:30' },
      { date: '2026-10-05', time: '11:00' },
    ],
  })
  const monday = days[7]
  const at = (time: string) => monday.slots.find((slot) => slot.time === time)!
  // 75 minutes from 10:00 reaches into 10:30: not bookable, but 10:00 itself is open.
  expect(at('10:00')).toMatchObject({ taken: true, held: false })
  expect(at('10:30')).toMatchObject({ taken: true, held: true })
  expect(at('10:45')).toMatchObject({ taken: true, held: false })
  expect(at('11:00')).toMatchObject({ taken: true, held: true })
  expect(at('09:00')).toMatchObject({ taken: false, held: false })
  // 75 minutes from 09:15 ends at 10:30, exactly where the closed time starts: still fine.
  expect(at('09:15')).toMatchObject({ taken: false, held: false })
  expect(at('09:30')).toMatchObject({ taken: true, held: false })
  expect(at('11:15')).toMatchObject({ taken: false, held: false })
})

test('an appointment covers its own cell and the quarter-hours after it', () => {
  expect(spanCells(45)).toBe(3)
  expect(spanCells(75)).toBe(5)
  expect(spanCells(50)).toBe(4)
  expect(spanStarts('2026-10-05T09:00:00', 45)).toEqual([
    '2026-10-05T09:00:00',
    '2026-10-05T09:15:00',
    '2026-10-05T09:30:00',
  ])
  expect(spanStarts('2026-10-05T23:45:00', 30)).toEqual(['2026-10-05T23:45:00'])
})

test('a length off the grid rounds up to whole quarter-hours for fitting and overlap', () => {
  const days = agendaDays('cut', saturday, {
    minutes: { cut: 50, beard: 30, both: 75 },
    blocks: [{ date: '2026-10-05', time: '10:00' }],
  })
  const monday = days[7]
  // 50 minutes counts as 60: 09:00 would run until 10:00, which is free; 09:15 would hit 10:00.
  expect(monday.slots.find((slot) => slot.time === '09:00')?.taken).toBe(false)
  expect(monday.slots.find((slot) => slot.time === '09:15')?.taken).toBe(true)
  expect(monday.slots.at(-1)?.time).toBe('17:00')
})

test('a confirmed booking of 75 minutes blocks five quarter-hours and every start that would overlap', () => {
  const days = agendaDays('beard', saturday, { bookings: [{ start: '2026-10-05T10:00:00', minutes: 75 }] })
  const monday = days[7]
  const at = (time: string) => monday.slots.find((slot) => slot.time === time)!
  for (const time of ['10:00', '10:15', '10:30', '10:45', '11:00']) expect(at(time).held).toBe(true)
  expect(at('11:15').held).toBe(false)
  // A 30-minute beard at 09:45 would run into 10:00.
  expect(at('09:45').taken).toBe(true)
  expect(at('09:30').taken).toBe(false)
  expect(at('11:15').taken).toBe(false)
})
