import { useState } from 'react'
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
import { formatGHS } from '@/lib/currency'
import type { PaymentMethod } from '@/types/db'

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'momo_mtn', label: 'MTN MoMo' },
  { value: 'momo_vodafone', label: 'Vodafone Cash' },
  { value: 'momo_airteltigo', label: 'AirtelTigo Money' },
  { value: 'card', label: 'Card' },
]

interface PaymentDialogProps {
  open: boolean
  total: number
  onClose: () => void
  onConfirm: (method: PaymentMethod, reference: string | null) => void
  submitting: boolean
}

export default function PaymentDialog({ open, total, onClose, onConfirm, submitting }: PaymentDialogProps) {
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [reference, setReference] = useState('')
  const [cashGiven, setCashGiven] = useState('')

  const change = method === 'cash' && cashGiven ? Number(cashGiven) - total : null
  const needsReference = method.startsWith('momo_') || method === 'card'

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Take Payment — {formatGHS(total)}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 py-2">
          {METHODS.map((m) => (
            <Button
              key={m.value}
              type="button"
              variant={method === m.value ? 'default' : 'outline'}
              onClick={() => setMethod(m.value)}
            >
              {m.label}
            </Button>
          ))}
        </div>

        {method === 'cash' && (
          <div className="space-y-2">
            <Label htmlFor="cash-given">Cash received (GHS)</Label>
            <Input
              id="cash-given"
              type="number"
              min={0}
              step="0.01"
              value={cashGiven}
              onChange={(e) => setCashGiven(e.target.value)}
              placeholder={total.toFixed(2)}
            />
            {change !== null && change >= 0 && (
              <p className="text-sm text-muted-foreground">Change due: {formatGHS(change)}</p>
            )}
            {change !== null && change < 0 && (
              <p className="text-sm text-destructive">Insufficient cash</p>
            )}
          </div>
        )}

        {needsReference && (
          <div className="space-y-2">
            <Label htmlFor="reference">
              {method === 'card' ? 'Card auth code' : 'Mobile money transaction ID'}
            </Label>
            <Input
              id="reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. 1234567890"
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(method, reference || null)}
            disabled={
              submitting ||
              (method === 'cash' && change !== null && change < 0) ||
              (needsReference && !reference)
            }
          >
            {submitting ? 'Processing…' : 'Confirm Payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
