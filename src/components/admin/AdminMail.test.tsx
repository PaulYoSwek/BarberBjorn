import { render, screen, waitFor } from '@testing-library/react'
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
  kind: 'slot' as const,
  status: 'confirmed' as const,
  mail_sent: true,
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
    body: 'Hoi Sam, Knippen op 2026-10-06 om 09:00.',
  })
})
