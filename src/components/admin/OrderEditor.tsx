import { useState } from 'react'
import type { ServiceId } from '../../content'
import {
  bookingMoney,
  discountFromPrice,
  formatMoney,
  parseMoney,
  priceFromDiscount,
  round2,
  type OrderItem,
  type Product,
} from '../../finance'
import { saveOrder, type InboxRow } from '../../planning-api'
import { serviceName } from './admin-defaults'

type Props = {
  row: InboxRow
  products: Product[]
  prices: Partial<Record<ServiceId, string>>
  onSaved: (id: string, charged: number | null, items: OrderItem[]) => void
  onClose: () => void
}

/** Plain number with a comma, for inputs: 30 → "30", 32.5 → "32,50". */
function num(value: number): string {
  return formatMoney(value).replace('€', '')
}

type Line = { item: OrderItem; priceText: string; discountText: string }

export function OrderEditor({ row, products, prices, onSaved, onClose }: Props) {
  const base = bookingMoney(row, prices)
  const [servicePrice, setServicePrice] = useState(base.servicePrice)
  const [serviceText, setServiceText] = useState(num(base.servicePrice))
  const [serviceDiscountText, setServiceDiscountText] = useState(num(discountFromPrice(base.serviceList, base.servicePrice)))
  const [lines, setLines] = useState<Line[]>(
    (row.items ?? []).map((item) => ({
      item,
      priceText: num(item.price),
      discountText: num(discountFromPrice(item.listPrice, item.price)),
    })),
  )
  const [pick, setPick] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const items = lines.map((line) => line.item)
  const money = bookingMoney({ ...row, charged: servicePrice, items }, prices)

  function onServicePrice(text: string) {
    setServiceText(text)
    const value = parseMoney(text)
    if (value === null) return
    setServicePrice(value)
    setServiceDiscountText(num(discountFromPrice(base.serviceList, value)))
  }

  function onServiceDiscount(text: string) {
    setServiceDiscountText(text)
    const value = parseMoney(text)
    if (value === null) return
    const price = priceFromDiscount(base.serviceList, value)
    setServicePrice(price)
    setServiceText(num(price))
  }

  type LinePatch = { priceText?: string; discountText?: string; item?: Partial<OrderItem> }

  function patchLine(index: number, next: LinePatch) {
    setLines((current) =>
      current.map((line, at) =>
        at === index
          ? {
              priceText: next.priceText ?? line.priceText,
              discountText: next.discountText ?? line.discountText,
              item: { ...line.item, ...(next.item ?? {}) },
            }
          : line,
      ),
    )
  }

  function onLinePrice(index: number, text: string) {
    const line = lines[index]
    const value = parseMoney(text)
    patchLine(index, {
      priceText: text,
      ...(value === null
        ? {}
        : { discountText: num(discountFromPrice(line.item.listPrice, value)), item: { price: value } }),
    })
  }

  function onLineDiscount(index: number, text: string) {
    const line = lines[index]
    const value = parseMoney(text)
    if (value === null) {
      patchLine(index, { discountText: text })
      return
    }
    const price = priceFromDiscount(line.item.listPrice, value)
    patchLine(index, { discountText: text, priceText: num(price), item: { price } })
  }

  function addProduct(id: string) {
    setPick('')
    const product = products.find((item) => item.id === id)
    if (!product) return
    const at = lines.findIndex((line) => line.item.productId === id)
    if (at >= 0) {
      patchLine(at, { item: { quantity: lines[at].item.quantity + 1 } })
      return
    }
    setLines((current) => [
      ...current,
      {
        item: { productId: product.id, name: product.name, listPrice: product.price, price: product.price, quantity: 1 },
        priceText: num(product.price),
        discountText: '0',
      },
    ])
  }

  /** Stock left for a product once this order is saved (what was saved before comes back first). */
  function stockAfter(productId: string | null, quantity: number): number | null {
    if (!productId) return null
    const product = products.find((item) => item.id === productId)
    if (!product) return null
    const before = (row.items ?? []).filter((item) => item.productId === productId).reduce((sum, item) => sum + item.quantity, 0)
    return product.stock + before - quantity
  }

  async function save() {
    if (busy) return
    setBusy(true)
    try {
      const charged = servicePrice === base.serviceList ? null : servicePrice
      const result = await saveOrder(row.id, { charged, items })
      if (!result.ok) {
        setNotice('Opslaan mislukt. Probeer het nog eens.')
        return
      }
      setNotice(null)
      onSaved(row.id, charged, items)
    } finally {
      setBusy(false)
    }
  }

  const choices = products.filter((product) => product.active)

  return (
    <form
      className="order"
      aria-label={`Bon ${row.name}`}
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <p className="order-title">Bon</p>
      {notice ? <p role="alert">{notice}</p> : null}
      <div className="order-line is-service">
        <span className="order-name">{serviceName(row.service)}</span>
        <span className="order-list">{formatMoney(base.serviceList)}</span>
        <label>
          Prijs
          <input inputMode="decimal" aria-label="Prijs dienst" value={serviceText} onChange={(event) => onServicePrice(event.target.value)} />
        </label>
        <label>
          Korting
          <input
            inputMode="decimal"
            aria-label="Korting dienst"
            value={serviceDiscountText}
            onChange={(event) => onServiceDiscount(event.target.value)}
          />
        </label>
      </div>
      {lines.map((line, index) => {
        const left = stockAfter(line.item.productId, line.item.quantity)
        return (
          <div key={line.item.id ?? `${line.item.productId}-${index}`} className="order-line">
            <span className="order-name">
              {line.item.name}
              {left !== null && left < 0 ? <em className="order-stock">niet genoeg op voorraad</em> : null}
            </span>
            <span className="order-list">{formatMoney(line.item.listPrice)} p/st</span>
            <label>
              Aantal
              <input
                type="number"
                min={1}
                max={100}
                aria-label={`Aantal ${line.item.name}`}
                value={line.item.quantity}
                onChange={(event) => {
                  const quantity = Math.max(1, Math.min(100, Math.round(Number(event.target.value) || 1)))
                  patchLine(index, { item: { quantity } })
                }}
              />
            </label>
            <label>
              Prijs
              <input
                inputMode="decimal"
                aria-label={`Prijs ${line.item.name}`}
                value={line.priceText}
                onChange={(event) => onLinePrice(index, event.target.value)}
              />
            </label>
            <label>
              Korting
              <input
                inputMode="decimal"
                aria-label={`Korting ${line.item.name}`}
                value={line.discountText}
                onChange={(event) => onLineDiscount(index, event.target.value)}
              />
            </label>
            <button
              type="button"
              className="order-remove"
              aria-label={`${line.item.name} verwijderen`}
              onClick={() => setLines((current) => current.filter((_, at) => at !== index))}
            >
              ×
            </button>
          </div>
        )
      })}
      <label className="order-add">
        Product toevoegen
        <select aria-label="Product toevoegen" value={pick} onChange={(event) => addProduct(event.target.value)}>
          <option value="">Kies een product</option>
          {choices.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} · {formatMoney(product.price)} · {product.stock} op voorraad
            </option>
          ))}
        </select>
      </label>
      {choices.length === 0 ? <p className="admin-hint">Nog geen producten. Voeg ze toe onder Producten.</p> : null}
      <dl className="order-totals">
        <div>
          <dt>Dienst</dt>
          <dd>{formatMoney(money.servicePrice)}</dd>
        </div>
        <div>
          <dt>Producten</dt>
          <dd>{formatMoney(money.productsTotal)}</dd>
        </div>
        <div>
          <dt>Korting</dt>
          <dd>{formatMoney(round2(money.discount))}</dd>
        </div>
        <div className="is-total">
          <dt>Totaal</dt>
          <dd data-testid="order-total">{formatMoney(money.total)}</dd>
        </div>
      </dl>
      <div className="admin-actions">
        <button type="submit" className="admin-primary" disabled={busy}>
          {busy ? 'Opslaan…' : 'Bon opslaan'}
        </button>
        <button type="button" onClick={onClose}>
          Sluiten
        </button>
      </div>
    </form>
  )
}
