import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { defaultSchedule } from '../../schedule'
import { AdminShell } from './AdminShell'

const { loadInbox, loadTemplates, sendClientMail, loadPublicSchedule } = vi.hoisted(() => ({
  loadInbox: vi.fn(),
  loadTemplates: vi.fn(),
  sendClientMail: vi.fn(),
  loadPublicSchedule: vi.fn(),
}))

vi.mock('../../planning-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../planning-api')>()
  return {
    ...actual,
    loadInbox,
    loadTemplates,
    sendClientMail,
    loadPublicSchedule,
  }
})

const client = {
  id: 'mail-1',
  service: 'cut' as const,
  name: 'Sam',
  email: 'sam@mail.nl',
  phone: '',
  start: '2026-10-06T09:00:00',
  minutes: 45,
  kind: 'slot' as const,
  status: 'confirmed' as const,
  lang: 'nl' as const,
  mail_sent: true,
  price: null,
  charged: null,
  items: [],
}

beforeEach(() => {
  loadInbox.mockReset()
  loadTemplates.mockReset()
  sendClientMail.mockReset()
  loadPublicSchedule.mockReset()
  loadInbox.mockResolvedValue([client])
  loadTemplates.mockResolvedValue([
    { key: 'thanks', lang: 'nl', subject: 'Hoi', body: 'Hoi {{name}}, {{service}} op {{date}} om {{time}}.' },
    { key: 'thanks', lang: 'en', subject: 'Hi', body: 'Hi {{name}}' },
    { key: 'accepted', lang: 'nl', subject: 'Ja', body: 'Ja {{name}}' },
    { key: 'accepted', lang: 'en', subject: 'Yes', body: 'Yes' },
    { key: 'declined', lang: 'nl', subject: 'Nee', body: 'Nee' },
    { key: 'declined', lang: 'en', subject: 'No', body: 'No' },
  ])
  sendClientMail.mockResolvedValue({ ok: true })
  loadPublicSchedule.mockResolvedValue(defaultSchedule)
})

test('Verstuur sends the selected client and template', async () => {
  render(<AdminShell />)
  await userEvent.click(screen.getByRole('button', { name: 'Mail' }))
  await userEvent.selectOptions(await screen.findByLabelText('Klant'), 'mail-1')
  await userEvent.selectOptions(screen.getByLabelText('Sjabloon'), 'thanks')
  await waitFor(() => expect(screen.getByLabelText('Onderwerp')).toHaveValue('Hoi'))
  await userEvent.click(screen.getByRole('button', { name: 'Verstuur' }))
  expect(sendClientMail).toHaveBeenCalledWith('mail-1', 'thanks', {
    subject: 'Hoi',
    body: 'Hoi Sam, Knippen op dinsdag 6 oktober om 09:00.',
  })
})

test('an English client gets the English template', async () => {
  loadInbox.mockResolvedValue([{ ...client, id: 'mail-en', name: 'Tom', lang: 'en' as const }])
  render(<AdminShell />)
  await userEvent.click(screen.getByRole('button', { name: 'Mail' }))
  await userEvent.selectOptions(await screen.findByLabelText('Klant'), 'mail-en')
  await userEvent.selectOptions(screen.getByLabelText('Sjabloon'), 'thanks')
  await waitFor(() => expect(screen.getByLabelText('Onderwerp')).toHaveValue('Hi'))
  expect(screen.getByLabelText('Bericht')).toHaveValue('Hi Tom')
  await userEvent.click(screen.getByRole('button', { name: 'Verstuur' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Mail verstuurd naar sam@mail.nl.')
})

test('a successful send clears Mail niet gegaan for that client', async () => {
  loadInbox.mockResolvedValue([{ ...client, mail_sent: false }])
  render(<AdminShell />)
  await userEvent.click(await screen.findByRole('button', { name: 'Inbox' }))
  expect(screen.getByText('Mail niet gegaan')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Opnieuw mailen' }))
  await userEvent.selectOptions(await screen.findByLabelText('Sjabloon'), 'thanks')
  await waitFor(() => expect(screen.getByLabelText('Onderwerp')).toHaveValue('Hoi'))
  await userEvent.click(screen.getByRole('button', { name: 'Verstuur' }))
  await waitFor(() => expect(sendClientMail).toHaveBeenCalled())
  await userEvent.click(screen.getByRole('button', { name: 'Inbox' }))
  const sent = screen.getByText('Sam').closest('li')
  if (!sent) throw new Error('missing row Sam')
  await waitFor(() => expect(within(sent).queryByText('Mail niet gegaan')).not.toBeInTheDocument())
  expect(within(sent).queryByRole('button', { name: 'Opnieuw' })).not.toBeInTheDocument()
})
