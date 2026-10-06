import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { defaultSchedule } from '../../schedule'
import { AdminShell } from './AdminShell'

const { loadServices, saveServices, loadTemplates, saveTemplates, loadInbox, loadPublicSchedule } = vi.hoisted(() => ({
  loadServices: vi.fn(),
  saveServices: vi.fn(),
  loadTemplates: vi.fn(),
  saveTemplates: vi.fn(),
  loadInbox: vi.fn(),
  loadPublicSchedule: vi.fn(),
}))

vi.mock('../../planning-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../planning-api')>()
  return {
    ...actual,
    loadServices,
    saveServices,
    loadTemplates,
    saveTemplates,
    loadInbox,
    loadPublicSchedule,
  }
})

const services = [
  { id: 'cut' as const, price: '€30', minutes: 45 },
  { id: 'beard' as const, price: '€15', minutes: 30 },
  { id: 'both' as const, price: '€40', minutes: 75 },
]

const templates = [
  { key: 'thanks' as const, lang: 'nl' as const, subject: 'Afspraak Bjorn’s Barber', body: 'Hoi {{name}}' },
  { key: 'thanks' as const, lang: 'en' as const, subject: 'Appointment Bjorn’s Barber', body: 'Hi {{name}}' },
  { key: 'accepted' as const, lang: 'nl' as const, subject: 'Afspraak bevestigd', body: 'Bevestigd {{name}}' },
  { key: 'accepted' as const, lang: 'en' as const, subject: 'Appointment confirmed', body: 'Confirmed {{name}}' },
  { key: 'declined' as const, lang: 'nl' as const, subject: 'Afspraak niet mogelijk', body: 'Niet mogelijk' },
  { key: 'declined' as const, lang: 'en' as const, subject: 'Could not book that time', body: 'Not possible' },
]

beforeEach(() => {
  loadServices.mockReset()
  saveServices.mockReset()
  loadTemplates.mockReset()
  saveTemplates.mockReset()
  loadInbox.mockReset()
  loadPublicSchedule.mockReset()
  loadServices.mockResolvedValue(services)
  loadTemplates.mockResolvedValue(templates)
  saveServices.mockResolvedValue({ ok: true })
  saveTemplates.mockResolvedValue({ ok: true })
  loadInbox.mockResolvedValue([])
  loadPublicSchedule.mockResolvedValue(defaultSchedule)
})

test('changing cut minutes to 50 snaps to 45 and saving calls saveServices', async () => {
  render(<AdminShell />)
  await userEvent.click(screen.getByRole('button', { name: 'Settings' }))
  const minutes = await screen.findByLabelText('Knippen minuten')
  const price = screen.getByLabelText('Knippen prijs')
  await userEvent.clear(minutes)
  await userEvent.type(minutes, '50')
  await userEvent.tab()
  expect(minutes).toHaveValue('45')
  await userEvent.clear(price)
  await userEvent.type(price, '€32')
  await userEvent.click(screen.getByRole('button', { name: 'Opslaan' }))
  expect(saveServices).toHaveBeenCalledWith([
    { id: 'cut', price: '€32', minutes: 45 },
    { id: 'beard', price: '€15', minutes: 30 },
    { id: 'both', price: '€40', minutes: 75 },
  ])
})

test('saving templates calls saveTemplates with the edited subject', async () => {
  render(<AdminShell />)
  await userEvent.click(screen.getByRole('button', { name: 'Settings' }))
  const subject = await screen.findByLabelText('Bedankt voor je boeking nl onderwerp')
  await userEvent.clear(subject)
  await userEvent.type(subject, 'Tot zo')
  await userEvent.click(screen.getByRole('button', { name: 'Opslaan' }))
  expect(saveTemplates).toHaveBeenCalledWith([
    { key: 'thanks', lang: 'nl', subject: 'Tot zo', body: 'Hoi {{name}}' },
    { key: 'thanks', lang: 'en', subject: 'Appointment Bjorn’s Barber', body: 'Hi {{name}}' },
    { key: 'accepted', lang: 'nl', subject: 'Afspraak bevestigd', body: 'Bevestigd {{name}}' },
    { key: 'accepted', lang: 'en', subject: 'Appointment confirmed', body: 'Confirmed {{name}}' },
    { key: 'declined', lang: 'nl', subject: 'Afspraak niet mogelijk', body: 'Niet mogelijk' },
    { key: 'declined', lang: 'en', subject: 'Could not book that time', body: 'Not possible' },
  ])
})

test('an empty template load does not save seed templates', async () => {
  loadTemplates.mockResolvedValue([])
  render(<AdminShell />)
  await userEvent.click(screen.getByRole('button', { name: 'Settings' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Sjablonen laden mislukt.')
  await userEvent.clear(await screen.findByLabelText('Knippen minuten'))
  await userEvent.type(screen.getByLabelText('Knippen minuten'), '50')
  await userEvent.click(screen.getByRole('button', { name: 'Opslaan' }))
  await waitFor(() => expect(saveServices).toHaveBeenCalled())
  expect(saveTemplates).not.toHaveBeenCalled()
})

test('a failed template load does not save seed templates', async () => {
  loadTemplates.mockRejectedValue(new Error('permission denied'))
  render(<AdminShell />)
  await userEvent.click(screen.getByRole('button', { name: 'Settings' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Sjablonen laden mislukt.')
  await userEvent.click(await screen.findByRole('button', { name: 'Opslaan' }))
  await waitFor(() => expect(saveServices).toHaveBeenCalled())
  expect(saveTemplates).not.toHaveBeenCalled()
})
