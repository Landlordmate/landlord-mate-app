import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

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

      if (customerEmail) {
        await updateUserByEmail(customerEmail, {
          subscription_status: 'active',
          stripe_customer_id: customerId,
        })
      }
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object
      const customerId = subscription.customer
      const status = subscription.status === 'trialing' ? 'active' : subscription.status
      await updateUserByCustomerId(customerId, { subscription_status: status })
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
