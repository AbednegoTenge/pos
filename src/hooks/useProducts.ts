import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Product } from '@/types/db'

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  async function refresh() {
    setLoading(true)
    const { data } = await supabase
      .from('products')
      .select('*, product_units(*)')
      .eq('is_active', true)
      .eq('product_units.is_active', true)
      .order('name')
    setProducts(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  return { products, loading, refresh }
}
