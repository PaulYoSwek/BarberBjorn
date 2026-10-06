import { useEffect, useState } from 'react'
import { clearAdminSession, hasAdminSession } from '../admin-session'
import { AdminGate } from '../components/admin/AdminGate'
import { AdminShell } from '../components/admin/AdminShell'
import { useHeadTags } from '../seo'

export function AdminPage() {
  const [open, setOpen] = useState(() => hasAdminSession())
  useHeadTags({ title: 'Dashboard · BarberBjorn', robots: 'noindex, nofollow' })

  useEffect(() => {
    document.documentElement.lang = 'nl'
    // The home-screen app made from this page should open the dashboard.
    const manifest = document.head.querySelector<HTMLLinkElement>('link[rel="manifest"]')
    const before = manifest?.getAttribute('href') ?? null
    manifest?.setAttribute('href', '/admin.webmanifest')
    return () => {
      if (manifest && before) manifest.setAttribute('href', before)
    }
  }, [])

  if (!open) return <AdminGate onSuccess={() => setOpen(true)} />
  return (
    <AdminShell
      onLogout={() => {
        clearAdminSession()
        setOpen(false)
      }}
    />
  )
}
