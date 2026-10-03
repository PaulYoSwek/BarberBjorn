import { useState } from 'react'
import { AdminGate } from '../components/admin/AdminGate'

export function AdminPage() {
  const [open, setOpen] = useState(() => sessionStorage.getItem('barber-admin') === '1')
  if (open) return <p>Agenda</p>
  return <AdminGate onSuccess={() => setOpen(true)} />
}
