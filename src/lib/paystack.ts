const SCRIPT_SRC = 'https://js.paystack.co/v1/inline.js'

export interface PaystackTransaction {
  reference: string
  status: string
}

interface PaystackPopupOptions {
  key: string
  email: string
  amount: number
  currency: string
  channels: string[]
  ref?: string
  onClose: () => void
  callback: (response: PaystackTransaction) => void
}

interface PaystackPopInterface {
  setup(options: PaystackPopupOptions): { openIframe(): void }
}

declare global {
  interface Window {
    PaystackPop?: PaystackPopInterface
  }
}

let scriptPromise: Promise<void> | null = null

function loadPaystackScript(): Promise<void> {
  if (window.PaystackPop) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Paystack — check your internet connection'))
    document.body.appendChild(script)
  })

  return scriptPromise
}

/**
 * Opens the Paystack popup and resolves with the transaction reference once
 * the customer completes payment. This only proves the popup finished — the
 * caller must still verify the reference server-side (see the
 * verify-paystack-payment Edge Function) before treating the sale as paid.
 */
export async function payWithPaystack(options: {
  publicKey: string
  email: string
  amountGhs: number
  channels: ('card' | 'mobile_money')[]
}): Promise<PaystackTransaction | null> {
  await loadPaystackScript()

  if (!window.PaystackPop) {
    throw new Error('Paystack failed to load')
  }

  return new Promise((resolve) => {
    const handler = window.PaystackPop!.setup({
      key: options.publicKey,
      email: options.email,
      amount: Math.round(options.amountGhs * 100),
      currency: 'GHS',
      channels: options.channels,
      onClose: () => resolve(null),
      callback: (response) => resolve(response),
    })
    handler.openIframe()
  })
}
