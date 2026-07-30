import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { getPendingCount, syncAllPending } from '@/lib/offlineQueue'
import { toast } from 'sonner'

export default function OfflineBanner() {
  const online = useOnlineStatus()
  const [pendingCount, setPendingCount] = useState(() => getPendingCount())

  useEffect(() => {
    if (!online) return
    syncAllPending().then(({ synced, remaining }) => {
      setPendingCount(remaining)
      if (synced > 0) toast.success(`Synced ${synced} offline change${synced === 1 ? '' : 's'}`)
    })
  }, [online])

  useEffect(() => {
    const interval = setInterval(() => setPendingCount(getPendingCount()), 3000)
    return () => clearInterval(interval)
  }, [])

  if (online && pendingCount === 0) return null

  return (
    <div className="flex items-center justify-center gap-2 bg-amber-500/90 px-4 py-1.5 text-sm font-medium text-amber-950">
      <WifiOff className="size-4" />
      {online
        ? `Syncing ${pendingCount} pending change${pendingCount === 1 ? '' : 's'}…`
        : `Offline — sales, refunds, and inventory edits are being saved locally${pendingCount > 0 ? ` (${pendingCount} pending)` : ''}`}
    </div>
  )
}
