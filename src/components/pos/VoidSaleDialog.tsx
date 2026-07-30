import { useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { formatGHS } from '@/lib/currency'
import type { TransactionRow } from '@/hooks/useTransactions'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface VoidSaleDialogProps {
  sale: TransactionRow
  onClose: () => void
  onVoided: () => void
}

export default function VoidSaleDialog({ sale, onClose, onVoided }: VoidSaleDialogProps) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (!reason.trim()) {
      toast.warning('Add a reason for voiding this sale')
      return
    }

    setSubmitting(true)
    const { error } = await supabase.rpc('void_sale', { p_sale_id: sale.id, p_reason: reason.trim() })
    setSubmitting(false)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Sale voided and stock restored')
    onVoided()
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Void sale — {sale.receipt_no}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This cancels the entire sale ({formatGHS(sale.total_ghs)}), restocks every item, and
            cannot be undone. Use this for mistaken or fraudulent sales — for a customer return,
            use Refund instead.
          </p>
          <div className="space-y-2">
            <Label htmlFor="void-reason">Reason</Label>
            <Textarea
              id="void-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. rung up by mistake, duplicate sale…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Voiding…' : 'Void sale'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
