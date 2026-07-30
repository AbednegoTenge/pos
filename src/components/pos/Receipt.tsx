import { forwardRef } from 'react'
import { formatGHS } from '@/lib/currency'
import { PAYMENT_LABELS } from '@/lib/payment'
import type { TaxBreakdown } from '@/lib/tax'
import type { BusinessSettings, CartLine, PaymentMethod } from '@/types/db'

interface ReceiptProps {
  receiptNo: string
  createdAt: string
  lines: CartLine[]
  totals: TaxBreakdown
  paymentMethod: PaymentMethod
  paymentReference: string | null
  settings: BusinessSettings | null
}

const Receipt = forwardRef<HTMLDivElement, ReceiptProps>(function Receipt(
  { receiptNo, createdAt, lines, totals, paymentMethod, paymentReference, settings },
  ref,
) {
  return (
    <div ref={ref} className="mx-auto w-[300px] space-y-2 bg-white p-4 font-mono text-xs text-black print:w-full">
      <div className="text-center">
        <p className="text-sm font-bold">{settings?.business_name ?? 'My Business'}</p>
        {settings?.address && <p>{settings.address}</p>}
        {settings?.phone && <p>{settings.phone}</p>}
        {settings?.tin && <p>TIN: {settings.tin}</p>}
      </div>
      <div className="border-t border-dashed border-black" />
      <div className="flex justify-between">
        <span>Receipt: {receiptNo}</span>
        <span>{new Date(createdAt).toLocaleString('en-GH')}</span>
      </div>
      <div className="border-t border-dashed border-black" />
      {lines.map((line) => (
        <div key={line.product.id} className="flex justify-between gap-2">
          <span className="flex-1 truncate">
            {line.product.name} x{line.quantity}
          </span>
          <span>{formatGHS(line.product.price_ghs * line.quantity)}</span>
        </div>
      ))}
      <div className="border-t border-dashed border-black" />
      <div className="flex justify-between">
        <span>Subtotal</span>
        <span>{formatGHS(totals.subtotal)}</span>
      </div>
      {totals.discount > 0 && (
        <div className="flex justify-between">
          <span>Discount</span>
          <span>-{formatGHS(totals.discount)}</span>
        </div>
      )}
      {totals.nhil > 0 && (
        <div className="flex justify-between">
          <span>NHIL</span>
          <span>{formatGHS(totals.nhil)}</span>
        </div>
      )}
      {totals.getfund > 0 && (
        <div className="flex justify-between">
          <span>GETFund</span>
          <span>{formatGHS(totals.getfund)}</span>
        </div>
      )}
      {totals.covidLevy > 0 && (
        <div className="flex justify-between">
          <span>COVID-19 Levy</span>
          <span>{formatGHS(totals.covidLevy)}</span>
        </div>
      )}
      {totals.vat > 0 && (
        <div className="flex justify-between">
          <span>VAT</span>
          <span>{formatGHS(totals.vat)}</span>
        </div>
      )}
      <div className="border-t border-dashed border-black" />
      <div className="flex justify-between text-sm font-bold">
        <span>TOTAL</span>
        <span>{formatGHS(totals.total)}</span>
      </div>
      <div className="flex justify-between">
        <span>Paid via</span>
        <span>{PAYMENT_LABELS[paymentMethod]}</span>
      </div>
      {paymentReference && (
        <div className="flex justify-between">
          <span>Ref</span>
          <span>{paymentReference}</span>
        </div>
      )}
      <div className="border-t border-dashed border-black" />
      <p className="text-center">{settings?.receipt_footer ?? 'Thank you for your patronage!'}</p>
    </div>
  )
})

export default Receipt
