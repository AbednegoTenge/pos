import { useMemo, useState } from 'react'
import { Search, Wifi, WifiOff } from 'lucide-react'
import { useTransactions, type TransactionRow } from '@/hooks/useTransactions'
import { useRefundHistory } from '@/hooks/useRefunds'
import { useAuth } from '@/context/AuthContext'
import { formatGHS } from '@/lib/currency'
import { PAYMENT_LABELS } from '@/lib/payment'
import RefundDialog from '@/components/pos/RefundDialog'
import VoidSaleDialog from '@/components/pos/VoidSaleDialog'
import type { SaleStatus } from '@/types/db'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'

const STATUS_BADGE: Record<SaleStatus, { label: string; className: string }> = {
  completed: { label: 'Completed', className: 'bg-chart-1/15 text-chart-1' },
  refunded: { label: 'Refunded', className: 'bg-chart-2/20 text-chart-2' },
  voided: { label: 'Voided', className: 'bg-destructive/10 text-destructive' },
}

function RefundHistory({ saleId }: { saleId: string }) {
  const { refunds, loading } = useRefundHistory(saleId)

  if (loading || refunds.length === 0) return null

  return (
    <>
      <Separator />
      <div className="space-y-2">
        <p className="text-sm font-medium">Refund history</p>
        {refunds.map((r) => (
          <div key={r.id} className="rounded-md border p-2 text-sm">
            <div className="flex justify-between">
              <span>{r.processed_by_name ?? 'Unknown staff'}</span>
              <span className="font-semibold">{formatGHS(r.total_ghs)}</span>
            </div>
            <p className="text-xs text-muted-foreground">{r.reason}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(r.created_at).toLocaleString('en-GH')}
            </p>
          </div>
        ))}
      </div>
    </>
  )
}

export default function TransactionsPage() {
  const { transactions, loading, error, refresh } = useTransactions()
  const { profile } = useAuth()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<SaleStatus | 'all'>('all')
  const [selected, setSelected] = useState<TransactionRow | null>(null)
  const [refundTarget, setRefundTarget] = useState<TransactionRow | null>(null)
  const [voidTarget, setVoidTarget] = useState<TransactionRow | null>(null)
  const canRefund = profile?.role === 'admin' || profile?.role === 'manager'

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return transactions.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false
      if (!q) return true
      return (
        t.receipt_no.toLowerCase().includes(q) ||
        t.cashier?.full_name.toLowerCase().includes(q) ||
        t.payment_reference?.toLowerCase().includes(q)
      )
    })
  }, [transactions, search, statusFilter])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Transactions</h1>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by receipt no., cashier, or payment reference…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as SaleStatus | 'all')}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
            <SelectItem value="voided">Voided</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Receipt</TableHead>
              <TableHead>Date &amp; time</TableHead>
              <TableHead>Cashier</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No transactions found.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.receipt_no}</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(t.created_at).toLocaleString('en-GH')}
                </TableCell>
                <TableCell>{t.cashier?.full_name ?? 'Unknown'}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {PAYMENT_LABELS[t.payment_method]}
                    {!t.synced && (
                      <span title="Recorded offline, synced later">
                        <WifiOff className="size-3.5 text-muted-foreground" />
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-semibold">{formatGHS(t.total_ghs)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={STATUS_BADGE[t.status].className}>
                    {STATUS_BADGE[t.status].label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setSelected(t)}>
                      View
                    </Button>
                    {canRefund && t.status === 'completed' && (
                      <Button size="sm" variant="destructive" onClick={() => setRefundTarget(t)}>
                        Refund
                      </Button>
                    )}
                    {canRefund && t.status === 'completed' && (
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => setVoidTarget(t)}>
                        Void
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selected.receipt_no}
                  <Badge variant="outline" className={STATUS_BADGE[selected.status].className}>
                    {STATUS_BADGE[selected.status].label}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <span className="text-muted-foreground">Date &amp; time</span>
                <span>{new Date(selected.created_at).toLocaleString('en-GH')}</span>

                <span className="text-muted-foreground">Cashier</span>
                <span>{selected.cashier?.full_name ?? 'Unknown'}</span>

                <span className="text-muted-foreground">Payment method</span>
                <span>{PAYMENT_LABELS[selected.payment_method]}</span>

                {selected.payment_reference && (
                  <>
                    <span className="text-muted-foreground">Payment reference</span>
                    <span>{selected.payment_reference}</span>
                  </>
                )}

                <span className="text-muted-foreground">Connectivity</span>
                <span className="flex items-center gap-1.5">
                  {selected.synced ? (
                    <>
                      <Wifi className="size-3.5" /> Synced live
                    </>
                  ) : (
                    <>
                      <WifiOff className="size-3.5" /> Recorded offline
                    </>
                  )}
                </span>
              </div>

              <Separator />

              <div className="space-y-1.5">
                {selected.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {item.product_name} × {item.quantity}
                    </span>
                    <span>{formatGHS(item.line_total_ghs)}</span>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatGHS(selected.subtotal_ghs)}</span>
                </div>
                {selected.discount_ghs > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Discount</span>
                    <span>-{formatGHS(selected.discount_ghs)}</span>
                  </div>
                )}
                {selected.nhil_ghs > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">NHIL</span>
                    <span>{formatGHS(selected.nhil_ghs)}</span>
                  </div>
                )}
                {selected.getfund_ghs > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">GETFund</span>
                    <span>{formatGHS(selected.getfund_ghs)}</span>
                  </div>
                )}
                {selected.covid_levy_ghs > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">COVID-19 Levy</span>
                    <span>{formatGHS(selected.covid_levy_ghs)}</span>
                  </div>
                )}
                {selected.vat_ghs > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">VAT</span>
                    <span>{formatGHS(selected.vat_ghs)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold">
                  <span>Total</span>
                  <span>{formatGHS(selected.total_ghs)}</span>
                </div>
              </div>

              {selected.status === 'voided' && (
                <>
                  <Separator />
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-destructive">Voided</p>
                    {selected.void_reason && (
                      <p className="text-xs text-muted-foreground">{selected.void_reason}</p>
                    )}
                    {selected.voided_at && (
                      <p className="text-xs text-muted-foreground">
                        {new Date(selected.voided_at).toLocaleString('en-GH')}
                      </p>
                    )}
                  </div>
                </>
              )}

              <RefundHistory saleId={selected.id} />

              {canRefund && selected.status === 'completed' && (
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => {
                      setRefundTarget(selected)
                      setSelected(null)
                    }}
                  >
                    Process refund
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 text-destructive"
                    onClick={() => {
                      setVoidTarget(selected)
                      setSelected(null)
                    }}
                  >
                    Void sale
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {refundTarget && (
        <RefundDialog
          sale={refundTarget}
          onClose={() => setRefundTarget(null)}
          onRefunded={refresh}
        />
      )}

      {voidTarget && (
        <VoidSaleDialog
          sale={voidTarget}
          onClose={() => setVoidTarget(null)}
          onVoided={refresh}
        />
      )}
    </div>
  )
}
