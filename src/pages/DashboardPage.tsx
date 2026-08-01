import type { ComponentType } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Wallet, Receipt, CalendarRange, TriangleAlert, TrendingUp, Trophy, Landmark } from 'lucide-react'
import { useSalesReport } from '@/hooks/useSalesReport'
import { useProducts } from '@/hooks/useProducts'
import { formatGHS } from '@/lib/currency'
import { PAYMENT_LABELS } from '@/lib/payment'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type StatColor = 'primary' | 'gold' | 'muted-green' | 'warning'

const STAT_COLOR_CLASSES: Record<StatColor, string> = {
  primary: 'bg-chart-1/15 text-chart-1',
  gold: 'bg-chart-2/20 text-chart-2',
  'muted-green': 'bg-chart-4/15 text-chart-4',
  warning: 'bg-destructive/10 text-destructive',
}

function StatTile({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: string
  icon: ComponentType<{ className?: string }>
  color: StatColor
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', STAT_COLOR_CLASSES[color])}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-xl font-semibold break-words sm:text-2xl">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { report, loading } = useSalesReport()
  const { products } = useProducts()
  const lowStockCount = products.filter((p) => p.stock_qty <= p.low_stock_threshold).length

  if (loading || !report) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Today's revenue" value={formatGHS(report.todayRevenue)} icon={Wallet} color="primary" />
        <StatTile label="Today's sales" value={String(report.todayCount)} icon={Receipt} color="gold" />
        <StatTile label="Last 7 days" value={formatGHS(report.weekRevenue)} icon={CalendarRange} color="muted-green" />
        <StatTile label="Low stock items" value={String(lowStockCount)} icon={TriangleAlert} color="warning" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4 text-chart-1" />
              Revenue — last 7 days
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.dailyRevenue}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} className="text-xs fill-muted-foreground" />
                <YAxis tickLine={false} axisLine={false} className="text-xs fill-muted-foreground" width={40} />
                <Tooltip
                  cursor={{ fill: 'var(--muted)' }}
                  formatter={(value) => formatGHS(Number(value))}
                  contentStyle={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="total" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="size-4 text-chart-2" />
              Top products
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {report.topProducts.length === 0 && (
              <p className="text-sm text-muted-foreground">No sales yet.</p>
            )}
            {report.topProducts.map((p) => (
              <div key={p.name} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.breakdown.map((b) => `${b.quantity} ${b.label}`).join(' + ')} sold
                  </p>
                </div>
                <span className="font-semibold">{formatGHS(p.revenue)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Landmark className="size-4 text-chart-4" />
            Today's till by payment method
          </CardTitle>
        </CardHeader>
        <CardContent>
          {report.todayByMethod.length === 0 && (
            <p className="text-sm text-muted-foreground">No sales recorded today yet.</p>
          )}
          {report.todayByMethod.length > 0 && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {report.todayByMethod.map((m) => (
                <div key={m.method} className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">{PAYMENT_LABELS[m.method]}</p>
                  <p className="mt-1 text-lg font-semibold">{formatGHS(m.total)}</p>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Use this to reconcile the cash drawer and mobile money accounts at close of day.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
