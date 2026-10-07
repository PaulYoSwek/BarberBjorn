import { useEffect, useRef, useState } from 'react'
import { templateFor } from '../../mail-templates'
import type { OrderItem, Product } from '../../finance'
import type { ServiceId } from '../../content'
import { isUnauthorized, loadInbox, loadProducts, loadServices, type InboxRow, type TemplateKey } from '../../planning-api'
import { AdminAgenda } from './AdminAgenda'
import { AdminClients } from './AdminClients'
import { AdminFinance } from './AdminFinance'
import { AdminProducts } from './AdminProducts'
import { AdminInbox } from './AdminInbox'
import { AdminMail } from './AdminMail'
import { AdminSettings } from './AdminSettings'

type Tab = 'agenda' | 'inbox' | 'klanten' | 'finance' | 'products' | 'mail' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'agenda', label: 'Agenda' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'klanten', label: 'Klanten' },
  { id: 'finance', label: 'Financiën' },
  { id: 'products', label: 'Producten' },
  { id: 'mail', label: 'Mail' },
  { id: 'settings', label: 'Settings' },
]

type Props = { pending?: number; onLogout?: () => void }

function applyInbox(incoming: InboxRow[], decided: ReadonlyMap<string, 'confirmed' | 'declined'>): InboxRow[] {
  return incoming.map((row) => {
    const status = decided.get(row.id)
    if (status && row.status === 'pending') return { ...row, status }
    return row
  })
}

export function AdminShell({ pending, onLogout }: Props) {
  const [tab, setTab] = useState<Tab>('agenda')
  const [rows, setRows] = useState<InboxRow[]>([])
  const [inboxLoaded, setInboxLoaded] = useState(false)
  const [inboxError, setInboxError] = useState<string | null>(null)
  const [mailClientId, setMailClientId] = useState<string | null>(null)
  const [mailKey, setMailKey] = useState<TemplateKey | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [productsReady, setProductsReady] = useState(true)
  const [productsLoaded, setProductsLoaded] = useState(false)
  const [prices, setPrices] = useState<Partial<Record<ServiceId, string>>>({})
  const [more, setMore] = useState(false)

  async function pullProducts() {
    try {
      const list = await loadProducts()
      setProducts(list.products)
      setProductsReady(list.ready)
    } catch {
      /* the tabs say so themselves */
    } finally {
      setProductsLoaded(true)
    }
  }

  function onOrderSaved(id: string, charged: number | null, items: OrderItem[]) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, charged, items } : row)))
    void pullProducts()
  }
  const inboxGeneration = useRef(0)
  const decidedStatus = useRef(new Map<string, 'confirmed' | 'declined'>())
  const logout = useRef(onLogout)
  useEffect(() => {
    logout.current = onLogout
  }, [onLogout])

  function pullInbox(reportError: boolean) {
    const generation = ++inboxGeneration.current
    loadInbox()
      .then((next) => {
        if (generation !== inboxGeneration.current) return
        setRows(applyInbox(next, decidedStatus.current))
        setInboxError(null)
        setInboxLoaded(true)
      })
      .catch((error: unknown) => {
        if (generation !== inboxGeneration.current) return
        // The session cookie or token ran out: back to the password screen.
        if (isUnauthorized(error)) {
          logout.current?.()
          return
        }
        if (reportError) {
          setInboxError('Inbox laden mislukt.')
          setInboxLoaded(true)
        }
      })
  }

  function onDecided(id: string, status: 'confirmed' | 'declined') {
    decidedStatus.current.set(id, status)
    setRows((current) => current.map((row) => (row.id === id ? { ...row, status } : row)))
    pullInbox(false)
  }

  function onMoved(id: string, start: string, sent: boolean) {
    decidedStatus.current.set(id, 'confirmed')
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, start, status: 'confirmed', mail_sent: sent } : row)),
    )
    pullInbox(false)
  }

  function markMailSent(id: string) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, mail_sent: true } : row)))
  }

  useEffect(() => {
    pullInbox(true)
    void pullProducts()
    loadServices()
      .then((services) => {
        const next: Partial<Record<ServiceId, string>> = {}
        for (const service of services) next[service.id] = service.price
        setPrices(next)
      })
      .catch(() => {})
    const onVisible = () => {
      if (document.visibilityState === 'visible') pullInbox(false)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      inboxGeneration.current += 1
    }
  }, [])

  const pendingCount = pending ?? rows.filter((row) => row.status === 'pending').length

  return (
    <div className="admin">
      <header className="admin-bar">
        <div className="admin-brand">
          <img className="admin-brand-mark" src="/logo-mark.png?v=3" alt="Bjorn’s Barber" width="28" height="28" />
          <span className="admin-brand-name">Bjorn’s Barber</span>
        </div>
        <nav className={`admin-tabs${more ? ' is-more' : ''}`} aria-label="Dashboard">
          {TABS.map((item) => {
            const on = tab === item.id
            const badge = item.id === 'inbox' && pendingCount > 0 ? pendingCount : 0
            return (
              <button
                key={item.id}
                type="button"
                className={on ? 'is-on' : undefined}
                aria-current={on ? 'page' : undefined}
                aria-label={badge ? `Inbox ${badge}` : undefined}
                onClick={() => {
                  setTab(item.id)
                  setMore(false)
                }}
              >
                {item.label}
                {badge ? <span className="admin-badge" aria-hidden="true">{badge}</span> : null}
              </button>
            )
          })}
          <button
            type="button"
            className="admin-more"
            aria-expanded={more}
            aria-label={more ? 'Minder tabs' : 'Meer tabs'}
            onClick={() => setMore((value) => !value)}
          >
            {more ? 'Minder' : 'Meer'}
          </button>
        </nav>
        <div className="admin-bar-end">
          <a className="admin-site" href="/">Naar de website</a>
          <button type="button" className="admin-logout" onClick={onLogout}>
            Uitloggen
          </button>
        </div>
      </header>
      <div className="admin-card">
        {tab === 'agenda' ? <AdminAgenda clients={rows} /> : null}
        {tab === 'finance' ? <AdminFinance rows={rows} prices={prices} /> : null}
        {tab === 'products' ? (
          <AdminProducts products={products} ready={productsReady} loaded={productsLoaded} onChanged={pullProducts} />
        ) : null}
        {tab === 'inbox' ? (
          <AdminInbox
            rows={rows}
            products={products}
            prices={prices}
            onOrderSaved={onOrderSaved}
            loading={!inboxLoaded}
            error={inboxError}
            onChanged={onDecided}
            onMoved={onMoved}
            onResend={(id) => {
              const row = rows.find((item) => item.id === id)
              setMailKey(row ? templateFor(row) : null)
              setMailClientId(id)
              setTab('mail')
            }}
          />
        ) : null}
        {tab === 'klanten' ? <AdminClients rows={rows} onDeleted={() => pullInbox(false)} /> : null}
        {tab === 'mail' ? <AdminMail rows={rows} clientId={mailClientId} templateKey={mailKey} onSent={markMailSent} /> : null}
        {tab === 'settings' ? <AdminSettings /> : null}
      </div>
    </div>
  )
}
