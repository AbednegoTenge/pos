export function generateReceiptNo(): string {
  const now = new Date()
  const stamp = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
  const rand = Math.floor(Math.random() * 900 + 100)
  return `RCT-${stamp}-${rand}`
}
