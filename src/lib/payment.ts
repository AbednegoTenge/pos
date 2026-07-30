import type { PaymentMethod } from '@/types/db'

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  momo_mtn: 'MTN MoMo',
  momo_vodafone: 'Vodafone Cash',
  momo_airteltigo: 'AirtelTigo Money',
  card: 'Card',
  credit: 'Credit',
}
