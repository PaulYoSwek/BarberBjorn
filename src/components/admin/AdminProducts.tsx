import { useEffect, useState, type FormEvent } from 'react'
import { formatMoney, parseMoney, type Product } from '../../finance'
import { saveProduct } from '../../planning-api'

type Props = {
  products: Product[]
  ready: boolean
  loaded: boolean
  onChanged: () => Promise<void> | void
}

type Draft = { id?: string; name: string; price: string; stock: string; active: boolean }

const EMPTY: Draft = { name: '', price: '', stock: '0', active: true }
const LOW_STOCK = 3

export function AdminProducts({ products, ready, loaded, onChanged }: Props) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [showInactive, setShowInactive] = useState(false)

  useEffect(() => {
    if (!done) return
    const timer = window.setTimeout(() => setDone(null), 6000)
    return () => window.clearTimeout(timer)
  }, [done])

  function edit(product: Product) {
    setNotice(null)
    setDone(null)
    setDraft({
      id: product.id,
      name: product.name,
      price: formatMoney(product.price).replace('€', ''),
      stock: String(product.stock),
      active: product.active,
    })
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft || busy) return
    const price = parseMoney(draft.price)
    const stock = Number(draft.stock)
    if (draft.name.trim().length < 1) return setNotice('Vul een naam in.')
    if (price === null || price < 0) return setNotice('Vul een prijs in, bijvoorbeeld 12,50.')
    if (!Number.isInteger(stock)) return setNotice('Voorraad is een heel getal.')
    setBusy(true)
    try {
      const result = await saveProduct({ id: draft.id, name: draft.name.trim(), price, stock, active: draft.active })
      if (!result.ok) {
        setNotice('Opslaan mislukt. Probeer het nog eens.')
        return
      }
      setNotice(null)
      setDone(draft.id ? `${draft.name.trim()} is bijgewerkt.` : `${draft.name.trim()} is toegevoegd.`)
      setDraft(null)
      await onChanged()
    } finally {
      setBusy(false)
    }
  }

  async function setActive(product: Product, active: boolean) {
    if (busy) return
    setBusy(true)
    try {
      const result = await saveProduct({ ...product, active })
      if (!result.ok) {
        setNotice('Opslaan mislukt. Probeer het nog eens.')
        return
      }
      setNotice(null)
      setDone(active ? `${product.name} wordt weer verkocht.` : `${product.name} wordt niet meer verkocht.`)
      await onChanged()
    } finally {
      setBusy(false)
    }
  }

  const shown = products.filter((product) => product.active || showInactive)
  const inactiveCount = products.filter((product) => !product.active).length
  const stockValue = products
    .filter((product) => product.active)
    .reduce((sum, product) => sum + product.price * Math.max(0, product.stock), 0)

  return (
    <div className="admin-products">
      <header className="admin-agenda-head">
        <div>
          <p className="admin-kicker">Verkoop</p>
          <h1>Producten</h1>
        </div>
        {draft ? null : (
          <button
            type="button"
            className="admin-add"
            onClick={() => {
              setNotice(null)
              setDone(null)
              setDraft({ ...EMPTY })
            }}
          >
            + Product toevoegen
          </button>
        )}
      </header>

      <dl className="admin-stats">
        <div>
          <dt>Producten</dt>
          <dd>{products.filter((product) => product.active).length}</dd>
        </div>
        <div>
          <dt>Bijna op</dt>
          <dd>{products.filter((product) => product.active && product.stock <= LOW_STOCK).length}</dd>
        </div>
        <div>
          <dt>Voorraadwaarde</dt>
          <dd>{formatMoney(stockValue)}</dd>
        </div>
      </dl>

      {notice ? <p role="alert">{notice}</p> : null}
      {done ? (
        <p className="admin-done" role="status">
          {done}
        </p>
      ) : null}
      {!ready ? <p className="admin-hint">De productenlijst in de database is nog niet actief.</p> : null}

      {draft ? (
        <form className="admin-client-form" onSubmit={submit} aria-label={draft.id ? 'Product bewerken' : 'Product toevoegen'}>
          <p className="admin-hours-title">{draft.id ? 'Product bewerken' : 'Nieuw product'}</p>
          <label>
            Naam
            <input value={draft.name} required maxLength={80} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          </label>
          <label>
            Prijs
            <input
              inputMode="decimal"
              value={draft.price}
              placeholder="12,50"
              onChange={(event) => setDraft({ ...draft, price: event.target.value })}
            />
          </label>
          <label>
            Voorraad
            <input
              type="number"
              inputMode="numeric"
              value={draft.stock}
              onChange={(event) => setDraft({ ...draft, stock: event.target.value })}
            />
          </label>
          <label className="admin-check">
            <input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />
            Te koop
          </label>
          <div className="admin-actions is-wide">
            <button type="submit" className="admin-primary" disabled={busy}>
              {busy ? 'Opslaan…' : 'Opslaan'}
            </button>
            <button type="button" onClick={() => setDraft(null)}>
              Annuleren
            </button>
          </div>
        </form>
      ) : null}

      {!loaded ? <p className="admin-hint">Producten laden…</p> : null}
      {loaded && products.length === 0 ? (
        <p className="admin-hint">Nog geen producten. Voeg bijvoorbeeld wax, pommade of een kam toe.</p>
      ) : null}

      <ul className="admin-product-list">
        {shown.map((product) => (
          <li key={product.id} className={`admin-product${product.active ? '' : ' is-off'}${product.active && product.stock <= LOW_STOCK ? ' is-low' : ''}`}>
            <div className="admin-product-head">
              <h2>{product.name}</h2>
              <strong>{formatMoney(product.price)}</strong>
            </div>
            <p className="admin-product-stock">
              {product.stock <= 0 ? 'Niet op voorraad' : `${product.stock} op voorraad`}
              {product.active && product.stock > 0 && product.stock <= LOW_STOCK ? ' · bijna op' : ''}
              {product.active ? '' : ' · niet te koop'}
            </p>
            <div className="admin-actions">
              <button type="button" aria-label={`${product.name} bewerken`} onClick={() => edit(product)}>
                Bewerken
              </button>
              <button
                type="button"
                aria-label={product.active ? `${product.name} niet meer verkopen` : `${product.name} weer verkopen`}
                disabled={busy}
                onClick={() => void setActive(product, !product.active)}
              >
                {product.active ? 'Niet meer verkopen' : 'Weer verkopen'}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {inactiveCount > 0 ? (
        <button type="button" className="admin-clear" onClick={() => setShowInactive((value) => !value)}>
          {showInactive ? 'Verberg producten die niet te koop zijn' : `Toon ${inactiveCount} product${inactiveCount === 1 ? '' : 'en'} niet te koop`}
        </button>
      ) : null}
    </div>
  )
}
