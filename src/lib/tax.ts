import type { BusinessSettings, CartLine } from '@/types/db'
import { roundMoney } from '@/lib/currency'

export interface TaxBreakdown {
  subtotal: number
  discount: number
  taxableBase: number
  nhil: number
  getfund: number
  covidLevy: number
  vat: number
  total: number
}

/**
 * Ghana's revenue authority (GRA) levies NHIL, GETFund, and the COVID-19
 * levy on the VAT-exclusive price *before* VAT itself is applied, then VAT
 * is charged on top of (price + those three levies). VAT-exempt goods
 * (e.g. certain staples) skip all four charges.
 */
export function computeSaleTotals(
  lines: CartLine[],
  discount: number,
  settings: Pick<
    BusinessSettings,
    'vat_rate' | 'nhil_rate' | 'getfund_rate' | 'covid_levy_rate' | 'tax_enabled'
  >,
): TaxBreakdown {
  const subtotal = roundMoney(
    lines.reduce((sum, line) => sum + line.product.price_ghs * line.quantity, 0),
  )
  const taxableSubtotal = lines
    .filter((line) => !line.product.vat_exempt)
    .reduce((sum, line) => sum + line.product.price_ghs * line.quantity, 0)

  // Spread the flat discount proportionally across taxable vs. exempt goods.
  const discountOnTaxable = subtotal > 0 ? discount * (taxableSubtotal / subtotal) : 0
  const taxableBase = roundMoney(Math.max(taxableSubtotal - discountOnTaxable, 0))

  if (!settings.tax_enabled) {
    return {
      subtotal,
      discount,
      taxableBase: 0,
      nhil: 0,
      getfund: 0,
      covidLevy: 0,
      vat: 0,
      total: roundMoney(subtotal - discount),
    }
  }

  const nhil = roundMoney(taxableBase * settings.nhil_rate)
  const getfund = roundMoney(taxableBase * settings.getfund_rate)
  const covidLevy = roundMoney(taxableBase * settings.covid_levy_rate)
  const vat = roundMoney((taxableBase + nhil + getfund + covidLevy) * settings.vat_rate)
  const total = roundMoney(subtotal - discount + nhil + getfund + covidLevy + vat)

  return { subtotal, discount, taxableBase, nhil, getfund, covidLevy, vat, total }
}
