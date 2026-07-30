import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Sale, SaleItem } from '@/types/db'

export interface TransactionRow extends Sale {
  cashier: { full_name: string } | null
  items: SaleItem[]
}

const PAGE_SIZE = 100

export function useTransactions() {
  const [transactions, setTransactions] = useState<TransactionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('sales')
      .select('*, cashier:profiles(full_name), items:sale_items(*)')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    if (error) setError(error.message)
    setTransactions((data as unknown as TransactionRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  return { transactions, loading, error, refresh }
}
