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
