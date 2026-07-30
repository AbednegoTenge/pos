import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { BusinessSettings } from '@/types/db'

export function useBusinessSettings() {
  const [settings, setSettings] = useState<BusinessSettings | null>(null)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    setLoading(true)
    const { data } = await supabase.from('business_settings').select('*').single()
    setSettings(data)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  return { settings, loading, refresh }
}
