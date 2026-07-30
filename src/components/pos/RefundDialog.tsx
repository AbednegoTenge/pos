import { useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { useRefundHistory, createRefund } from '@/hooks/useRefunds'
import { formatGHS } from '@/lib/currency'
import { queueRefund } from '@/lib/offlineQueue'
import type { TransactionRow } from '@/hooks/useTransactions'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface RefundDialogProps {
  sale: TransactionRow
  onClose: () => void
  onRefunded: () => void
}

export default function RefundDialog({ sale, onClose, onRefunded }: RefundDialogProps) {
  const { profile } = useAuth()
  const { refundedQtyBySaleItem, loading } = useRefundHistory(sale.id)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function remainingQty(saleItemId: string, originalQty: number) {
    return Math.max(0, originalQty - (refundedQtyBySaleItem[saleItemId] ?? 0))
  }

  function setQty(saleItemId: string, value: number, max: number) {
    setQuantities((prev) => ({ ...prev, [saleItemId]: Math.max(0, Math.min(value, max)) }))
  }

  const selectedLines = sale.items
    .map((item) => {
      const qty = quantities[item.id] ?? 0
      return qty > 0 ? { saleItemId: item.id, quantity: qty, lineTotalGhs: qty * item.unit_price_ghs } : null
    })
    .filter((l): l is NonNullable<typeof l> => l !== null)

  const refundTotal = selectedLines.reduce((sum, l) => sum + l.lineTotalGhs, 0)

  async function handleSubmit() {
    if (selectedLines.length === 0) {
      toast.warning('Select at least one item to refund')
      return
    }
    if (!reason.trim()) {
      toast.warning('Add a reason for this refund')
      return
    }

    setSubmitting(true)
    try {
      await createRefund({
        saleId: sale.id,
        processedBy: profile?.id ?? null,
        reason: reason.trim(),
        lines: selectedLines,
      })
      toast.success('Refund recorded and stock restored')
      onRefunded()
      onClose()
    } catch {
      queueRefund({
        localId: crypto.randomUUID(),
        saleId: sale.id,
        processedBy: profile?.id ?? null,
        reason: reason.trim(),
        lines: selectedLines,
        createdAt: new Date().toISOString(),
      })
      toast.info('No connection — refund saved offline and will sync (stock updates once synced)')
      onRefunded()
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Refund — {sale.receipt_no}</DialogTitle>
        </DialogHeader>

        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {!loading && (
          <div className="space-y-3">
            {sale.items.map((item) => {
              const max = remainingQty(item.id, item.quantity)
              return (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border p-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Bought {item.quantity} · {max} eligible to refund
                    </p>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={max}
                    step="1"
                    disabled={max === 0}
                    value={quantities[item.id] || ''}
                    onChange={(e) => setQty(item.id, Number(e.target.value) || 0, max)}
                    className="h-8 w-20 text-right"
                    placeholder="0"
                  />
                </div>
              )
            })}

            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. wrong item, defective, customer changed mind…"
              />
            </div>

            <div className="flex justify-between border-t pt-2 text-sm font-semibold">
              <span>Refund total</span>
              <span>{formatGHS(refundTotal)}</span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={submitting || loading || selectedLines.length === 0}
          >
            {submitting ? 'Processing…' : `Refund ${formatGHS(refundTotal)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
