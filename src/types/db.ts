export type StaffRole = 'admin' | 'manager' | 'cashier'

export type PaymentMethod =
  | 'cash'
  | 'momo_mtn'
  | 'momo_vodafone'
  | 'momo_airteltigo'
  | 'card'
  | 'credit'

export type SaleStatus = 'completed' | 'refunded' | 'voided'

export interface Profile {
  id: string
  full_name: string
  role: StaffRole
  is_active: boolean
  created_at: string
}

export interface Category {
  id: string
  name: string
  created_at: string
}

export interface Product {
  id: string
  category_id: string | null
  name: string
  sku: string | null
  barcode: string | null
  unit: string
  price_ghs: number
  cost_ghs: number | null
  vat_exempt: boolean
  stock_qty: number
  low_stock_threshold: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Sale {
  id: string
  receipt_no: string
  cashier_id: string | null
  subtotal_ghs: number
  discount_ghs: number
  vat_ghs: number
  nhil_ghs: number
  getfund_ghs: number
  covid_levy_ghs: number
  total_ghs: number
  payment_method: PaymentMethod
  payment_reference: string | null
  status: SaleStatus
  synced: boolean
  created_at: string
}

export interface SaleItem {
  id: string
  sale_id: string
  product_id: string | null
  product_name: string
  unit_price_ghs: number
  quantity: number
  line_total_ghs: number
}

export interface Refund {
  id: string
  sale_id: string
  processed_by: string | null
  reason: string
  total_ghs: number
  created_at: string
}

export interface RefundItem {
  id: string
  refund_id: string
  sale_item_id: string
  quantity: number
  line_total_ghs: number
}

export interface BusinessSettings {
  id: true
  business_name: string
  address: string | null
  phone: string | null
  tin: string | null
  vat_rate: number
  nhil_rate: number
  getfund_rate: number
  covid_levy_rate: number
  tax_enabled: boolean
  receipt_footer: string | null
}

export interface CartLine {
  product: Product
  quantity: number
}
