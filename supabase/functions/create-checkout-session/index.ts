import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// APP_URL is set per-project (production vs staging) so checkout redirects
// land back on the environment the customer actually started from, instead
// of always bouncing to production. Falls back to production if unset.
const appUrl = (Deno.env.get('APP_URL') ?? 'https://app.thelandlordmate.com').replace(/\/$/, '')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { priceId, userId, email } = await req.json()

    if (!priceId || !userId || !email) {
      return new Response(JSON.stringify({ error: 'Missing priceId, userId, or email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      client_reference_id: userId,
      subscription_data: {
        trial_period_days: 7,
        metadata: { userId },
      },
      metadata: { userId },
      allow_promotion_codes: true,
      success_url: `${appUrl}/?action=subscribed`,
      cancel_url: `${appUrl}/`,
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('create-checkout-session error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
