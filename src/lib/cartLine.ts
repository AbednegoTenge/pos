import type { CartLine } from '@/types/db'

/** Unique key for a cart line: the same product sold as different packagings
 * (e.g. "Piece" vs. "Box of 24") must not merge into one line. */
export function cartLineKey(line: Pick<CartLine, 'product' | 'productUnit'>): string {
  return `${line.product.id}:${line.productUnit?.id ?? 'base'}`
}

/** Price charged per unit of the packaging actually sold. */
export function cartLineUnitPrice(line: Pick<CartLine, 'product' | 'productUnit'>): number {
  return line.productUnit?.price_ghs ?? line.product.price_ghs
}

/** How many base stock units (products.stock_qty) one of this line's packaging represents. */
export function cartLineConversionQty(line: Pick<CartLine, 'productUnit'>): number {
  return line.productUnit?.conversion_qty ?? 1
}

/** Total base stock units this line consumes (quantity sold × packaging size). */
export function cartLineBaseQty(line: Pick<CartLine, 'productUnit' | 'quantity'>): number {
  return line.quantity * cartLineConversionQty(line)
}

/** Display label for the packaging, e.g. "Box of 24" or the product's own unit ("pc", "kg"). */
export function cartLineUnitLabel(line: Pick<CartLine, 'product' | 'productUnit'>): string {
  return line.productUnit?.label ?? line.product.unit
}
