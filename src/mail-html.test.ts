import { expect, test } from 'vitest'
import { DASHBOARD_BUTTON, mailButton, mailHtml } from './mail-html'
import { templateFor } from './mail-templates'

test('the html mail keeps Bjorn’s paragraphs and line breaks and escapes what he types', () => {
  const html = mailHtml('Hoi <Sam>,\n\nKnippen\ndinsdag 6 oktober om 10:00\n\nTot dan,\nBjorn', 'nl', 'Je afspraak')
  expect(html).toContain('Hoi &lt;Sam&gt;,</p>')
  expect(html).toContain('Knippen<br>dinsdag 6 oktober om 10:00</p>')
  expect(html).not.toContain('<Sam>')
  expect(html).toContain('<title>Je afspraak</title>')
  // The preview line in the inbox skips the greeting.
  expect(html).toMatch(/display:none[^>]*>Knippen</)
})

test('the html mail carries the logo, the given button and the contact details', () => {
  const html = mailHtml('Hi Sam', 'en', '', mailButton('thanks', 'en'))
  expect(html).toContain('https://www.bjornsbarber.nl/logo-lockup-white.png')
  expect(html).toContain('href="mailto:bjorn899@hotmail.com?subject=Reschedule"')
  expect(html).toContain('>Reschedule</a>')
  expect(html).toContain('Ferdinandstraat 21, 4571 AN Axel')
  expect(html).toContain('href="tel:+31648163783"')
  expect(mailHtml('Hi Sam', 'en')).not.toContain('<a href="mailto')
})

test('a booked client is offered to move the appointment, a declined one to pick again', () => {
  expect(mailButton('thanks', 'nl')).toEqual({ label: 'Afspraak verzetten', href: 'mailto:bjorn899@hotmail.com?subject=Afspraak%20verzetten' })
  expect(mailButton('accepted', 'nl')?.label).toBe('Afspraak verzetten')
  expect(mailButton('moved', 'en')?.label).toBe('Reschedule')
  expect(mailButton('declined', 'nl')).toEqual({ label: 'Ander moment kiezen', href: 'https://www.bjornsbarber.nl/#afspraak' })
  expect(mailButton('received', 'nl')).toBeNull()
  expect(DASHBOARD_BUTTON.href).toBe('https://www.bjornsbarber.nl/admin')
})

test('mailing a time request again picks the received mail until Bjorn decides', () => {
  expect(templateFor({ status: 'pending', kind: 'custom' })).toBe('received')
  expect(templateFor({ status: 'confirmed', kind: 'custom' })).toBe('accepted')
  expect(templateFor({ status: 'declined', kind: 'custom' })).toBe('declined')
  expect(templateFor({ status: 'confirmed', kind: 'slot' })).toBe('thanks')
})
