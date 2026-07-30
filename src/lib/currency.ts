export function formatGHS(amount: number): string {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    currencyDisplay: 'symbol',
  }).format(amount)
}

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100
}
