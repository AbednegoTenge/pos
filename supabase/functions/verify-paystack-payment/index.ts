// Verifies a Paystack transaction server-side before the POS treats a sale
// as paid. The client-side popup callback firing is not proof of payment —
// it can be spoofed — so the actual charge status must be confirmed here,
// using the Paystack secret key, which never reaches the browser.
//
// Deploy with: supabase functions deploy verify-paystack-payment
// Requires the secret: supabase secrets set PAYSTACK_SECRET_KEY=sk_...

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VerifyRequest {
  reference: string
  expectedAmountGhs: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { reference, expectedAmountGhs } = (await req.json()) as VerifyRequest
    if (!reference || typeof expectedAmountGhs !== 'number') {
      return new Response(JSON.stringify({ verified: false, message: 'Missing reference or amount' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const secretKey = Deno.env.get('PAYSTACK_SECRET_KEY')
    if (!secretKey) {
      return new Response(JSON.stringify({ verified: false, message: 'Paystack is not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    })
    const paystackJson = await paystackRes.json()

    if (!paystackRes.ok || !paystackJson.status) {
      return new Response(
        JSON.stringify({ verified: false, message: paystackJson.message ?? 'Verification request failed' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const data = paystackJson.data
    const expectedPesewas = Math.round(expectedAmountGhs * 100)
    const isSuccessful = data.status === 'success'
    const amountMatches = data.amount === expectedPesewas
    const currencyMatches = data.currency === 'GHS'

    if (!isSuccessful || !amountMatches || !currencyMatches) {
      return new Response(
        JSON.stringify({
          verified: false,
          message: !isSuccessful
            ? `Payment status: ${data.status}`
            : 'Paid amount does not match the sale total',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({
        verified: true,
        reference: data.reference,
        channel: data.channel,
        network: data.authorization?.bank ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(JSON.stringify({ verified: false, message: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
