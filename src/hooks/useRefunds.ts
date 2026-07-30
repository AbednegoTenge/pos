import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Refund, RefundItem } from '@/types/db'

export interface RefundWithItems extends Refund {
  processed_by_name: string | null
  items: RefundItem[]
}

export function useRefundHistory(saleId: string) {
  const [refunds, setRefunds] = useState<RefundWithItems[]>([])
  const [refundedQtyBySaleItem, setRefundedQtyBySaleItem] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  async function refresh() {
    setLoading(true)
    const { data } = await supabase
      .from('refunds')
      .select('*, processed_by_profile:profiles(full_name), items:refund_items(*)')
      .eq('sale_id', saleId)
      .order('created_at', { ascending: false })

    const rows = (data ?? []).map((r) => ({
      ...r,
      processed_by_name: r.processed_by_profile?.full_name ?? null,
    })) as RefundWithItems[]

    const qtyByItem: Record<string, number> = {}
    for (const refund of rows) {
      for (const item of refund.items) {
        qtyByItem[item.sale_item_id] = (qtyByItem[item.sale_item_id] ?? 0) + item.quantity
      }
    }

    setRefunds(rows)
    setRefundedQtyBySaleItem(qtyByItem)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [saleId])

  return { refunds, refundedQtyBySaleItem, loading, refresh }
}

export async function createRefund(params: {
  saleId: string
  processedBy: string | null
  reason: string
  lines: { saleItemId: string; quantity: number; lineTotalGhs: number }[]
}) {
  const total = params.lines.reduce((sum, l) => sum + l.lineTotalGhs, 0)

  const { data: refund, error } = await supabase
    .from('refunds')
    .insert({
      sale_id: params.saleId,
      processed_by: params.processedBy,
      reason: params.reason,
      total_ghs: total,
    })
    .select('id')
    .single()

  if (error || !refund) throw error ?? new Error('Failed to create refund')

  const { error: itemsError } = await supabase.from('refund_items').insert(
    params.lines.map((l) => ({
      refund_id: refund.id,
      sale_item_id: l.saleItemId,
      quantity: l.quantity,
      line_total_ghs: l.lineTotalGhs,
    })),
  )

  if (itemsError) throw itemsError
}
