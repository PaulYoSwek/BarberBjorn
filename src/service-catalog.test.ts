import { expect, test } from 'vitest'
import { completeService, newServiceId, offered, serviceLabel } from './service-catalog'

test('a new id is a readable slug, unique among the ones in use', () => {
  expect(newServiceId('Kinderen knippen', ['cut'])).toBe('kinderen-knippen')
  expect(newServiceId('Wenkbrauwen épileren', [])).toBe('wenkbrauwen-epileren')
  expect(newServiceId('Knippen + baard', ['knippen-en-baard'])).toBe('knippen-en-baard-2')
  expect(newServiceId('!!!', [])).toBe('dienst')
})

test('a stored row without texts takes the built-in ones; English falls back to Dutch', () => {
  expect(completeService({ id: 'cut', price: '€30', minutes: 45 }).name).toEqual({ nl: 'Knippen', en: 'Cut' })
  const kids = completeService({ id: 'kids', price: '€15', minutes: 30, name: { nl: 'Kinderen', en: '' } })
  expect(kids.name).toEqual({ nl: 'Kinderen', en: 'Kinderen' })
  expect(kids.active).toBe(true)
  expect(serviceLabel('kids', 'en', [kids])).toBe('Kinderen')
  expect(serviceLabel('unknown', 'nl', [kids])).toBe('unknown')
})

test('only visible services are offered, in their order', () => {
  const list = [
    completeService({ id: 'b', price: '€1', minutes: 15, name: { nl: 'B' }, sort: 2 }),
    completeService({ id: 'a', price: '€1', minutes: 15, name: { nl: 'A' }, sort: 1 }),
    completeService({ id: 'c', price: '€1', minutes: 15, name: { nl: 'C' }, sort: 0, active: false }),
  ]
  expect(offered(list).map((item) => item.id)).toEqual(['a', 'b'])
})
