import { supabase } from '@/lib/supabase'
import type { CartLine, PaymentMethod } from '@/types/db'
import type { TaxBreakdown } from '@/lib/tax'
import { cartLineUnitPrice } from '@/lib/cartLine'

const STORAGE_KEY = 'pos.pendingSales'

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

export function getPendingSales(): PendingSale[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw ? (JSON.parse(raw) as PendingSale[]) : []
}

function savePendingSales(sales: PendingSale[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sales))
}

export function queueSale(sale: PendingSale) {
  const sales = getPendingSales()
  sales.push(sale)
  savePendingSales(sales)
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

  savePendingSales(stillPending)
  return { synced, remaining: stillPending.length }
}
