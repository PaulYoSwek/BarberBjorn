import { expect, test } from 'vitest'
import { CONTACT, copy } from './content'

test('dutch and english carry the same keys and the locked facts', () => {
  expect(Object.keys(copy.nl).sort()).toEqual(Object.keys(copy.en).sort())
  expect(copy.nl.tagline).toBe('Een goede knip. Zonder haast.')
  expect(copy.en.tagline).toBe('A proper cut. No rush.')
  expect(copy.nl.services.map((item) => item.price)).toEqual(['€30', '€15', '€40'])
  expect(copy.en.services.map((item) => item.id)).toEqual(['cut', 'beard', 'both'])
  expect(copy.nl.days.filter((day) => day.closed).map((day) => day.key)).toEqual(['sat', 'sun'])
  expect(copy.nl.faq).toHaveLength(5)
  expect(copy.en.faq).toHaveLength(5)
  expect(CONTACT.email).toBe('hallo@barberbjorn.nl')
  expect(CONTACT.phone).toBe('06 12 34 56 78')
})
