import { useMemo, useRef, useState } from 'react'
import { useReactToPrint } from 'react-to-print'
import { Minus, Plus, Trash2, Search, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import { useProducts } from '@/hooks/useProducts'
import { useBusinessSettings } from '@/hooks/useBusinessSettings'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { computeSaleTotals } from '@/lib/tax'
import { formatGHS } from '@/lib/currency'
import { generateReceiptNo } from '@/lib/receipt'
import { queueSale } from '@/lib/offlineQueue'
import {
  cartLineBaseQty,
  cartLineConversionQty,
  cartLineKey,
  cartLineUnitLabel,
  cartLineUnitPrice,
} from '@/lib/cartLine'
import type { CartLine, PaymentMethod, Product, ProductUnit } from '@/types/db'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import PaymentDialog from '@/components/pos/PaymentDialog'
import Receipt from '@/components/pos/Receipt'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

export default function CheckoutPage() {
  const { products, loading, refresh } = useProducts()
  const { settings } = useBusinessSettings()
  const { profile } = useAuth()

  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [discount, setDiscount] = useState(0)
  const [unitPickerProduct, setUnitPickerProduct] = useState<Product | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [completedSale, setCompletedSale] = useState<{
    receiptNo: string
    createdAt: string
    lines: CartLine[]
    totals: ReturnType<typeof computeSaleTotals>
    paymentMethod: PaymentMethod
    paymentReference: string | null
    cashGiven: number | null
  } | null>(null)

  const receiptRef = useRef<HTMLDivElement>(null)
  const printReceipt = useReactToPrint({ contentRef: receiptRef })

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q),
    )
  }, [products, search])

  const totals = useMemo(
    () =>
      computeSaleTotals(cart, discount, {
        vat_rate: settings?.vat_rate ?? 0.15,
        nhil_rate: settings?.nhil_rate ?? 0.025,
        getfund_rate: settings?.getfund_rate ?? 0.025,
        covid_levy_rate: settings?.covid_levy_rate ?? 0.01,
        tax_enabled: settings?.tax_enabled ?? true,
      }),
    [cart, discount, settings],
  )

  function handleProductClick(product: Product) {
    if (product.product_units && product.product_units.length > 0) {
      setUnitPickerProduct(product)
      return
    }
    addToCart(product, null)
  }

  function addToCart(product: Product, productUnit: ProductUnit | null) {
    setCart((prev) => {
      const key = cartLineKey({ product, productUnit })
      const conversionQty = productUnit?.conversion_qty ?? 1

      // Stock is a shared pool across all packagings of the same product, so
      // check total base units already reserved across every line for it.
      const baseUnitsAlreadyInCart = prev
        .filter((l) => l.product.id === product.id)
        .reduce((sum, l) => sum + cartLineBaseQty(l), 0)

      if (baseUnitsAlreadyInCart + conversionQty > product.stock_qty) {
        toast.warning(`Only ${product.stock_qty} ${product.unit} of ${product.name} in stock`)
        return prev
      }

      const existing = prev.find((l) => cartLineKey(l) === key)
      if (existing) {
        return prev.map((l) => (cartLineKey(l) === key ? { ...l, quantity: l.quantity + 1 } : l))
      }
      return [...prev, { product, productUnit, quantity: 1 }]
    })
  }

  function updateQuantity(line: CartLine, delta: number) {
    const key = cartLineKey(line)
    setCart((prev) =>
      prev
        .map((l) => {
          if (cartLineKey(l) !== key) return l
          const conversionQty = cartLineConversionQty(l)
          const baseUnitsInOtherLines = prev
            .filter((o) => o.product.id === l.product.id && cartLineKey(o) !== key)
            .reduce((sum, o) => sum + cartLineBaseQty(o), 0)
          const maxQuantity = Math.floor(
            Math.max(0, l.product.stock_qty - baseUnitsInOtherLines) / conversionQty,
          )
          return { ...l, quantity: Math.max(0, Math.min(l.quantity + delta, maxQuantity)) }
        })
        .filter((l) => l.quantity > 0),
    )
  }

  function removeLine(line: CartLine) {
    const key = cartLineKey(line)
    setCart((prev) => prev.filter((l) => cartLineKey(l) !== key))
  }

  function resetCart() {
    setCart([])
    setDiscount(0)
    setCartOpen(false)
  }

  function renderCartLines() {
    return (
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {cart.length === 0 && (
          <p className="mt-8 text-center text-sm text-muted-foreground">Cart is empty</p>
        )}
        {cart.map((line) => (
          <div key={cartLineKey(line)} className="flex items-center gap-2 rounded-md border p-2">
            <div className="flex-1">
              <p className="text-sm font-medium">{line.product.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatGHS(cartLineUnitPrice(line))} × {line.quantity} {cartLineUnitLabel(line)}
              </p>
            </div>
            <Button size="icon" variant="outline" className="size-7" onClick={() => updateQuantity(line, -1)}>
              <Minus className="size-3" />
            </Button>
            <span className="w-6 text-center text-sm">{line.quantity}</span>
            <Button size="icon" variant="outline" className="size-7" onClick={() => updateQuantity(line, 1)}>
              <Plus className="size-3" />
            </Button>
            <Button size="icon" variant="ghost" className="size-7 text-destructive" onClick={() => removeLine(line)}>
              <Trash2 className="size-3" />
            </Button>
          </div>
        ))}
      </div>
    )
  }

  function renderCartSummary() {
    return (
      <div className="space-y-2 border-t p-4 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Discount (GHS)</span>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={discount || ''}
            onChange={(e) => setDiscount(Number(e.target.value) || 0)}
            className="h-7 w-24 text-right"
          />
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatGHS(totals.subtotal)}</span>
        </div>
        {totals.vat + totals.nhil + totals.getfund + totals.covidLevy > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>VAT + Levies</span>
            <span>{formatGHS(totals.vat + totals.nhil + totals.getfund + totals.covidLevy)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-bold">
          <span>Total</span>
          <span>{formatGHS(totals.total)}</span>
        </div>
        <Button
          className="w-full"
          size="lg"
          disabled={cart.length === 0}
          onClick={() => {
            setCartOpen(false)
            setPaymentOpen(true)
          }}
        >
          Charge {formatGHS(totals.total)}
        </Button>
      </div>
    )
  }

  const cartItemCount = cart.reduce((sum, line) => sum + line.quantity, 0)

  async function handleConfirmPayment(
    method: PaymentMethod,
    reference: string | null,
    cashGiven: number | null,
  ) {
    setSubmitting(true)
    const receiptNo = generateReceiptNo()
    const createdAt = new Date().toISOString()

    if (reference) {
      try {
        const { data: dupes } = await supabase
          .from('sales')
          .select('id')
          .eq('payment_method', method)
          .eq('payment_reference', reference)
          .neq('status', 'voided')
          .limit(1)
        if (dupes && dupes.length > 0) {
          toast.error('This payment reference has already been used on another sale')
          setSubmitting(false)
          return
        }
      } catch {
        // Can't reach Supabase to check (likely offline) — don't block a
        // legitimate sale on a check we can't perform right now.
      }
    }

    try {
      const { data: saleRow, error } = await supabase
        .from('sales')
        .insert({
          receipt_no: receiptNo,
          cashier_id: profile?.id ?? null,
          subtotal_ghs: totals.subtotal,
          discount_ghs: totals.discount,
          vat_ghs: totals.vat,
          nhil_ghs: totals.nhil,
          getfund_ghs: totals.getfund,
          covid_levy_ghs: totals.covidLevy,
          total_ghs: totals.total,
          payment_method: method,
          payment_reference: reference,
          synced: true,
          created_at: createdAt,
        })
        .select('id')
        .single()

      if (error || !saleRow) throw error ?? new Error('Sale insert failed')

      const { error: itemsError } = await supabase.from('sale_items').insert(
        cart.map((line) => ({
          sale_id: saleRow.id,
          product_id: line.product.id,
          product_unit_id: line.productUnit?.id ?? null,
          product_name: line.product.name,
          unit_price_ghs: cartLineUnitPrice(line),
          quantity: line.quantity,
          line_total_ghs: cartLineUnitPrice(line) * line.quantity,
        })),
      )
      if (itemsError) throw itemsError

      toast.success('Sale completed')
      refresh()
    } catch {
      queueSale({
        localId: crypto.randomUUID(),
        receiptNo,
        cashierId: profile?.id ?? null,
        lines: cart,
        totals,
        paymentMethod: method,
        paymentReference: reference,
        createdAt,
      })
      toast.info('No connection — sale saved offline and will sync automatically')
    }

    setCompletedSale({
      receiptNo,
      createdAt,
      lines: cart,
      totals,
      paymentMethod: method,
      paymentReference: reference,
      cashGiven,
    })
    setPaymentOpen(false)
    setSubmitting(false)
    resetCart()
  }

  return (
    <div className="flex flex-col gap-4 lg:grid lg:h-full lg:grid-cols-3 lg:gap-6">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, SKU, or barcode…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="grid flex-1 auto-rows-min grid-cols-2 gap-3 overflow-y-auto pb-24 sm:grid-cols-3 lg:grid-cols-4 lg:pb-4">
          {loading && <p className="col-span-full text-muted-foreground">Loading products…</p>}
          {!loading && filteredProducts.length === 0 && (
            <p className="col-span-full text-muted-foreground">No products found.</p>
          )}
          {filteredProducts.map((product) => (
            <button key={product.id} type="button" onClick={() => handleProductClick(product)}>
              <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
                <CardContent className="flex h-full flex-col justify-between p-3 text-left">
                  <div>
                    <p className="line-clamp-2 text-sm font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {product.stock_qty} {product.unit} left
                    </p>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="font-semibold">{formatGHS(product.price_ghs)}</span>
                    <div className="flex gap-1">
                      {product.product_units && product.product_units.length > 0 && (
                        <Badge variant="secondary" className="text-[10px]">
                          {product.product_units.length + 1} options
                        </Badge>
                      )}
                      {product.stock_qty <= product.low_stock_threshold && (
                        <Badge variant="destructive" className="text-[10px]">
                          Low
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      </div>

      <div className="hidden flex-col rounded-lg border bg-card lg:flex">
        {renderCartLines()}
        {renderCartSummary()}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card p-3 lg:hidden">
        <Button
          variant="outline"
          className="w-full justify-between"
          size="lg"
          onClick={() => setCartOpen(true)}
        >
          <span className="flex items-center gap-2">
            <ShoppingCart className="size-4" />
            {cartItemCount > 0 ? `${cartItemCount} item${cartItemCount === 1 ? '' : 's'}` : 'Cart is empty'}
          </span>
          <span className="font-semibold">{formatGHS(totals.total)}</span>
        </Button>
      </div>

      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="bottom" className="flex h-[85vh] flex-col p-0">
          <SheetHeader className="border-b">
            <SheetTitle>Cart</SheetTitle>
          </SheetHeader>
          {renderCartLines()}
          {renderCartSummary()}
        </SheetContent>
      </Sheet>

      <PaymentDialog
        open={paymentOpen}
        total={totals.total}
        onClose={() => setPaymentOpen(false)}
        onConfirm={handleConfirmPayment}
        submitting={submitting}
      />

      <Dialog open={!!unitPickerProduct} onOpenChange={(o) => !o && setUnitPickerProduct(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{unitPickerProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {unitPickerProduct && (
              <button
                type="button"
                className="w-full rounded-md border p-3 text-left hover:bg-accent"
                onClick={() => {
                  addToCart(unitPickerProduct, null)
                  setUnitPickerProduct(null)
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">Sell by {unitPickerProduct.unit}</span>
                  <span>{formatGHS(unitPickerProduct.price_ghs)}</span>
                </div>
              </button>
            )}
            {unitPickerProduct?.product_units?.map((pu) => (
              <button
                key={pu.id}
                type="button"
                className="w-full rounded-md border p-3 text-left hover:bg-accent"
                onClick={() => {
                  addToCart(unitPickerProduct, pu)
                  setUnitPickerProduct(null)
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{pu.label}</span>
                  <span>{formatGHS(pu.price_ghs)}</span>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!completedSale} onOpenChange={(o) => !o && setCompletedSale(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Sale complete</DialogTitle>
          </DialogHeader>
          {completedSale && (
            <Receipt
              ref={receiptRef}
              receiptNo={completedSale.receiptNo}
              createdAt={completedSale.createdAt}
              lines={completedSale.lines}
              totals={completedSale.totals}
              paymentMethod={completedSale.paymentMethod}
              paymentReference={completedSale.paymentReference}
              cashGiven={completedSale.cashGiven}
              settings={settings}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompletedSale(null)}>
              New sale
            </Button>
            <Button onClick={() => printReceipt()}>Print receipt</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
