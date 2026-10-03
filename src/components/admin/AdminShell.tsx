import { useState } from 'react'
import { AdminAgenda } from './AdminAgenda'

type Tab = 'agenda' | 'inbox' | 'mail' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'agenda', label: 'Agenda' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'mail', label: 'Mail' },
  { id: 'settings', label: 'Settings' },
]

type Props = { pending?: number }

export function AdminShell({ pending = 0 }: Props) {
  const [tab, setTab] = useState<Tab>('agenda')

  return (
    <div className="admin">
      <div className="admin-card">
        {tab === 'agenda' ? <AdminAgenda /> : null}
      </div>
      <nav className="admin-tabs">
        {TABS.map((item) => {
          const on = tab === item.id
          const label = item.id === 'inbox' && pending > 0 ? `Inbox ${pending}` : item.label
          return (
            <button
              key={item.id}
              type="button"
              className={on ? 'is-on' : undefined}
              aria-current={on ? 'page' : undefined}
              onClick={() => setTab(item.id)}
            >
              {label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
