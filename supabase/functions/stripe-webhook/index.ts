import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

// ---- Price ID -> subscription tier -----------------------------------------------------
// FIX (2026-08-06): subscription_tier was never being set anywhere — checkout.session.completed
// only wrote subscription_status, so every user sat on the DB column default of 'starter'
// regardless of what they actually paid for. Pro/Portfolio subscribers were being tier-gated
// and property-capped as if they were on Starter. This map fixes that by resolving the tier
// straight from the Stripe price ID, which is authoritative regardless of whether the
// subscription came from a fresh checkout or a self-serve plan change in the billing portal.
//
// Mirrors src/App.js PRICE_IDS_LIVE / PRICE_IDS_TEST — keep the two in sync. Old/archived
// prices are kept here (not removed) so existing subscribers on them still resolve correctly.
const PRICE_ID_TO_TIER: Record<string, string> = {
  // --- live mode ---
  // Legacy Starter (£149/yr, £14.90/mo) — archived 2026-08-06, existing subscribers only.
  'price_1TpZbC5NBmtcziU4LjXThhwZ': 'starter',
  'price_1TpZbC5NBmtcziU438DdnrvJ': 'starter',
  // Current Starter (£99/yr, £9/mo) — created 2026-08-06, set as the product's default price.
  'price_1U1PiT5NBmtcziU4v4h6fTIC': 'starter',
  'price_1U1PiU5NBmtcziU4uUk9lU66': 'starter',
  'price_1TpZcK5NBmtcziU4tXlBZm2K': 'pro',
  'price_1TpZcK5NBmtcziU4HNgnGsxM': 'pro',
  'price_1TpZcS5NBmtcziU41LfqiSyT': 'portfolio',
  'price_1TpZcS5NBmtcziU4b7kMtQJ1': 'portfolio',
  'price_1TpZcY5NBmtcziU4yJyvyefF': 'agent_starter',
  'price_1TpZcY5NBmtcziU499WC0B73': 'agent_starter',
  'price_1TpZcd5NBmtcziU4Me9q0PYO': 'agent_pro',
  'price_1TpZcc5NBmtcziU4pxw1xjBT': 'agent_pro',
  'price_1TpZci5NBmtcziU45Y97MTe5': 'agent_portfolio',
  'price_1TpZci5NBmtcziU493pLJiSk': 'agent_portfolio',
  // --- test mode ---
  'price_1TvCSQ5NBmtcziU4HLmmN41Z': 'starter',
  'price_1TvCUQ5NBmtcziU4tJyVhDZz': 'starter',
  // TODO(pricing-2026-08-06): test-mode £99/£9 Starter prices still need creating by hand
  // (Stripe connector used for the live-mode prices has no test-mode access) — swap these
  // placeholders for the real price_... IDs once they exist. Until then, test-mode checkout
  // for Starter will 400.
  'price_TODO_STARTER_ANNUAL_99_TEST': 'starter',
  'price_TODO_STARTER_MONTHLY_9_TEST': 'starter',
  'price_1TvDiZ5NBmtcziU47L4e1vaJ': 'pro',
  'price_1TvDka5NBmtcziU477YOOX5r': 'pro',
  'price_1TvDq55NBmtcziU4aI5ec1JE': 'portfolio',
  'price_1TvDsB5NBmtcziU4COBiUSTH': 'portfolio',
  'price_1TvDvV5NBmtcziU40rOcLjcH': 'agent_starter',
  'price_1TvDwW5NBmtcziU4JPMJVedF': 'agent_starter',
  'price_1TvDys5NBmtcziU4qktBSPZe': 'agent_pro',
  'price_1TvE015NBmtcziU4ZR1x99jR': 'agent_pro',
  'price_1TvE2B5NBmtcziU4eq0h1TFw': 'agent_portfolio',
  'price_1TvE3P5NBmtcziU4UGzMG5dM': 'agent_portfolio',
}

function tierForPriceId(priceId: string | undefined | null): string | null {
  if (!priceId) return null
  return PRICE_ID_TO_TIER[priceId] ?? null
}

function tierFromSubscription(subscription: Stripe.Subscription): string | null {
  const priceId = subscription.items?.data?.[0]?.price?.id
  return tierForPriceId(priceId)
}

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const body = await req.text()
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''

  let event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, webhookSecret)
  } catch (err) {
    return new Response(`Webhook error: ${err.message}`, { status: 400 })
  }

  const supabaseUrl = Deno.env.get('PROJECT_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY') ?? ''

  const updateUserByEmail = async (email: string, fields: Record<string, unknown>) => {
    await fetch(`${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify(fields),
    })
  }

  const updateUserByCustomerId = async (customerId: string, fields: Record<string, unknown>) => {
    await fetch(`${supabaseUrl}/rest/v1/users?stripe_customer_id=eq.${encodeURIComponent(customerId)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify(fields),
    })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      const customerId = session.customer
      const customerEmail = session.customer_details?.email

      const fields: Record<string, unknown> = {
        subscription_status: 'active',
        stripe_customer_id: customerId,
      }

      // Resolve tier + subscription ID from the subscription itself — the checkout session
      // event doesn't carry price/line-item detail by default.
      if (session.subscription) {
        try {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
          const tier = tierFromSubscription(subscription)
          if (tier) fields.subscription_tier = tier
          fields.stripe_subscription_id = subscription.id
        } catch (err) {
          console.error('checkout.session.completed: failed to retrieve subscription for tier lookup:', err.message)
        }
      }

      if (customerEmail) {
        await updateUserByEmail(customerEmail, fields)
      }
      break
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object
      const customerId = subscription.customer
      const status = subscription.status === 'trialing' ? 'active' : subscription.status
      const tier = tierFromSubscription(subscription)

      const fields: Record<string, unknown> = {
        subscription_status: status,
        stripe_subscription_id: subscription.id,
      }
      // Only overwrite tier if we actually recognise the price — an unrecognised price
      // (e.g. a manually-created one-off in the dashboard) shouldn't blow away a correct
      // existing tier.
      if (tier) fields.subscription_tier = tier

      await updateUserByCustomerId(customerId, fields)
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object
      const customerId = subscription.customer
      await updateUserByCustomerId(customerId, { subscription_status: 'canceled' })
      break
    }

    default:
      break
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
