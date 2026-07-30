import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface DailyRevenue {
  date: string
  total: number
}

export interface TopProduct {
  name: string
  revenue: number
  quantity: number
}

export interface SalesReport {
  todayRevenue: number
  todayCount: number
  weekRevenue: number
  dailyRevenue: DailyRevenue[]
  topProducts: TopProduct[]
}

const DAYS = 7

export function useSalesReport() {
  const [report, setReport] = useState<SalesReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const since = new Date()
      since.setDate(since.getDate() - (DAYS - 1))
      since.setHours(0, 0, 0, 0)

      const { data: sales } = await supabase
        .from('sales')
        .select('id, total_ghs, created_at')
        .eq('status', 'completed')
        .gte('created_at', since.toISOString())

      const todayKey = new Date().toDateString()
      const byDay = new Map<string, number>()
      for (let i = 0; i < DAYS; i++) {
        const d = new Date(since)
        d.setDate(since.getDate() + i)
        byDay.set(d.toDateString(), 0)
      }

      let todayRevenue = 0
      let todayCount = 0
      let weekRevenue = 0
      const saleIds: string[] = []

      for (const sale of sales ?? []) {
        const key = new Date(sale.created_at).toDateString()
        byDay.set(key, (byDay.get(key) ?? 0) + sale.total_ghs)
        weekRevenue += sale.total_ghs
        saleIds.push(sale.id)
        if (key === todayKey) {
          todayRevenue += sale.total_ghs
          todayCount += 1
        }
      }

      const dailyRevenue: DailyRevenue[] = Array.from(byDay.entries()).map(([date, total]) => ({
        date: new Date(date).toLocaleDateString('en-GH', { weekday: 'short' }),
        total: Math.round(total * 100) / 100,
      }))

      let topProducts: TopProduct[] = []
      if (saleIds.length > 0) {
        const { data: items } = await supabase
          .from('sale_items')
          .select('product_name, line_total_ghs, quantity')
          .in('sale_id', saleIds)

        const byProduct = new Map<string, TopProduct>()
        for (const item of items ?? []) {
          const existing = byProduct.get(item.product_name)
          if (existing) {
            existing.revenue += item.line_total_ghs
            existing.quantity += item.quantity
          } else {
            byProduct.set(item.product_name, {
              name: item.product_name,
              revenue: item.line_total_ghs,
              quantity: item.quantity,
            })
          }
        }
        topProducts = Array.from(byProduct.values())
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5)
      }

      setReport({ todayRevenue, todayCount, weekRevenue, dailyRevenue, topProducts })
      setLoading(false)
    }

    load()
  }, [])

  return { report, loading }
}
