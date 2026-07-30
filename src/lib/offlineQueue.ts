import { supabase } from '@/lib/supabase'
import type { CartLine, PaymentMethod } from '@/types/db'
import type { TaxBreakdown } from '@/lib/tax'
import { cartLineUnitPrice } from '@/lib/cartLine'

const SALES_KEY = 'pos.pendingSales'
const REFUNDS_KEY = 'pos.pendingRefunds'
const PRODUCT_SAVES_KEY = 'pos.pendingProductSaves'

export interface PendingSale {
  localId: string
  receiptNo: string
  cashierId: string | null
  lines: CartLine[]
  totals: TaxBreakdown
  paymentMethod: PaymentMethod
  paymentReference: string | null
  createdAt: string
}

export interface PendingRefund {
  localId: string
  saleId: string
  processedBy: string | null
  reason: string
  lines: { saleItemId: string; quantity: number; lineTotalGhs: number }[]
  createdAt: string
}

export interface PendingProductUnitInput {
  id?: string
  label: string
  conversion_qty: number
  price_ghs: number
}

export interface PendingProductSave {
  localId: string
  /** Existing product id when editing; null when this is a new product not yet created anywhere. */
  productId: string | null
  payload: {
    name: string
    category_id: string | null
    sku: string | null
    barcode: string | null
    unit: string
    price_ghs: number
    cost_ghs: number | null
    vat_exempt: boolean
    stock_qty: number
    low_stock_threshold: number
  }
  units: PendingProductUnitInput[]
  removedUnitIds: string[]
  createdAt: string
}

function getQueue<T>(key: string): T[] {
  const raw = localStorage.getItem(key)
  return raw ? (JSON.parse(raw) as T[]) : []
}

function saveQueue<T>(key: string, items: T[]) {
  localStorage.setItem(key, JSON.stringify(items))
}

export function getPendingSales(): PendingSale[] {
  return getQueue<PendingSale>(SALES_KEY)
}

export function queueSale(sale: PendingSale) {
  saveQueue(SALES_KEY, [...getPendingSales(), sale])
}

export function getPendingRefunds(): PendingRefund[] {
  return getQueue<PendingRefund>(REFUNDS_KEY)
}

export function queueRefund(refund: PendingRefund) {
  saveQueue(REFUNDS_KEY, [...getPendingRefunds(), refund])
}

export function getPendingProductSaves(): PendingProductSave[] {
  return getQueue<PendingProductSave>(PRODUCT_SAVES_KEY)
}

export function queueProductSave(save: PendingProductSave) {
  saveQueue(PRODUCT_SAVES_KEY, [...getPendingProductSaves(), save])
}

export function getPendingCount(): number {
  return getPendingSales().length + getPendingRefunds().length + getPendingProductSaves().length
}

/** Attempts to push every queued sale to Supabase; leaves failures queued for the next retry. */
export async function syncPendingSales(): Promise<{ synced: number; remaining: number }> {
  const sales = getPendingSales()
  if (sales.length === 0) return { synced: 0, remaining: 0 }

  const stillPending: PendingSale[] = []
  let synced = 0

  for (const sale of sales) {
    try {
      const { data: saleRow, error } = await supabase
        .from('sales')
        .insert({
          receipt_no: sale.receiptNo,
          cashier_id: sale.cashierId,
          subtotal_ghs: sale.totals.subtotal,
          discount_ghs: sale.totals.discount,
          vat_ghs: sale.totals.vat,
          nhil_ghs: sale.totals.nhil,
          getfund_ghs: sale.totals.getfund,
          covid_levy_ghs: sale.totals.covidLevy,
          total_ghs: sale.totals.total,
          payment_method: sale.paymentMethod,
          payment_reference: sale.paymentReference,
          synced: true,
          created_at: sale.createdAt,
        })
        .select('id')
        .single()

      if (error || !saleRow) throw error

      const { error: itemsError } = await supabase.from('sale_items').insert(
        sale.lines.map((line) => ({
          sale_id: saleRow.id,
          product_id: line.product.id,
          product_unit_id: line.productUnit?.id ?? null,
          product_name: line.product.name,
          unit_price_ghs: cartLineUnitPrice(line),
          quantity: line.quantity,
          line_total_ghs: cartLineUnitPrice(line) * line.quantity,
        })),
      )
      if (itemsError) throw itemsError

      synced += 1
    } catch {
      stillPending.push(sale)
    }
  }

  saveQueue(SALES_KEY, stillPending)
  return { synced, remaining: stillPending.length }
}

/** Attempts to push every queued refund to Supabase; leaves failures queued for the next retry. */
export async function syncPendingRefunds(): Promise<{ synced: number; remaining: number }> {
  const refunds = getPendingRefunds()
  if (refunds.length === 0) return { synced: 0, remaining: 0 }

  const stillPending: PendingRefund[] = []
  let synced = 0

  for (const refund of refunds) {
    try {
      const total = refund.lines.reduce((sum, l) => sum + l.lineTotalGhs, 0)

      const { data: refundRow, error } = await supabase
        .from('refunds')
        .insert({
          sale_id: refund.saleId,
          processed_by: refund.processedBy,
          reason: refund.reason,
          total_ghs: total,
          created_at: refund.createdAt,
        })
        .select('id')
        .single()

      if (error || !refundRow) throw error

      const { error: itemsError } = await supabase.from('refund_items').insert(
        refund.lines.map((l) => ({
          refund_id: refundRow.id,
          sale_item_id: l.saleItemId,
          quantity: l.quantity,
          line_total_ghs: l.lineTotalGhs,
        })),
      )
      if (itemsError) throw itemsError

      synced += 1
    } catch {
      stillPending.push(refund)
    }
  }

  saveQueue(REFUNDS_KEY, stillPending)
  return { synced, remaining: stillPending.length }
}

/** Attempts to push every queued product/packaging save to Supabase; leaves failures queued for the next retry. */
export async function syncPendingProductSaves(): Promise<{ synced: number; remaining: number }> {
  const saves = getPendingProductSaves()
  if (saves.length === 0) return { synced: 0, remaining: 0 }

  const stillPending: PendingProductSave[] = []
  let synced = 0

  for (const save of saves) {
    // Track the real id once the product row exists so a failed retry updates
    // it instead of inserting a duplicate product.
    const attempt = { ...save }
    try {
      const { data: productRow, error } = attempt.productId
        ? await supabase.from('products').update(attempt.payload).eq('id', attempt.productId).select('id').single()
        : await supabase.from('products').insert(attempt.payload).select('id').single()

      if (error || !productRow) throw error ?? new Error('Product save failed')
      attempt.productId = productRow.id

      const unitsError = (
        await Promise.all([
          attempt.removedUnitIds.length > 0
            ? supabase.from('product_units').update({ is_active: false }).in('id', attempt.removedUnitIds)
            : Promise.resolve({ error: null }),
          ...attempt.units.map((u) => {
            const unitPayload = {
              product_id: productRow.id,
              label: u.label,
              conversion_qty: u.conversion_qty,
              price_ghs: u.price_ghs,
              is_active: true,
            }
            return u.id
              ? supabase.from('product_units').update(unitPayload).eq('id', u.id)
              : supabase.from('product_units').insert(unitPayload)
          }),
        ])
      ).find((r) => r.error)?.error

      if (unitsError) throw unitsError

      synced += 1
    } catch {
      stillPending.push(attempt)
    }
  }

  saveQueue(PRODUCT_SAVES_KEY, stillPending)
  return { synced, remaining: stillPending.length }
}

/** Syncs all queued write types (sales, refunds, product saves) in parallel. */
export async function syncAllPending(): Promise<{ synced: number; remaining: number }> {
  const [sales, refunds, productSaves] = await Promise.all([
    syncPendingSales(),
    syncPendingRefunds(),
    syncPendingProductSaves(),
  ])
  return {
    synced: sales.synced + refunds.synced + productSaves.synced,
    remaining: sales.remaining + refunds.remaining + productSaves.remaining,
  }
}
