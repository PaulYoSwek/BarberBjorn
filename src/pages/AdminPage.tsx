import { useState } from 'react'
import { AdminGate } from '../components/admin/AdminGate'
import { AdminShell } from '../components/admin/AdminShell'

export function AdminPage() {
  const [open, setOpen] = useState(() => sessionStorage.getItem('barber-admin') === '1')
  if (!open) return <AdminGate onSuccess={() => setOpen(true)} />
  return (
    <AdminShell
      onLogout={() => {
        sessionStorage.removeItem('barber-admin')
        setOpen(false)
      }}
    />
  )
}
