import { useEffect } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Product } from '@/types/db'

/** Pops an in-app toast the moment a product's stock crosses at/below its
 * low_stock_threshold (via a sale, a refund reversal, or a manual edit) —
 * only on the crossing itself, not on every subsequent update while it stays
 * low, so a slow-moving item doesn't re-alert on each sale. */
export function useLowStockAlerts(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return

    const channel = supabase
      .channel('low-stock-alerts')
      .on<Product>(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'products' },
        ({ old: prev, new: next }) => {
          if (!next.is_active) return
          const wasAboveThreshold = (prev.stock_qty ?? 0) > (prev.low_stock_threshold ?? 0)
          const isNowAtOrBelow = next.stock_qty <= next.low_stock_threshold
          if (wasAboveThreshold && isNowAtOrBelow) {
            toast.warning(`${next.name} is low on stock`, {
              description: `Only ${next.stock_qty} ${next.unit} left (threshold: ${next.low_stock_threshold})`,
            })
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [enabled])
}
