import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Tier configurations - use env vars to support test/live modes
const TIER_CONFIG: Record<string, { tier: string; clientLimit: number }> = {
  // Live prices (defaults)
  'price_1SxHgCBDGilw48s7lrc9Pjox': { tier: 'starter', clientLimit: 10 },
  'price_1SxHgDBDGilw48s7vI6lQPE6': { tier: 'pro', clientLimit: 30 },
  'price_1SxHgDBDGilw48s7hHTBfSGO': { tier: 'studio', clientLimit: 75 },
  'price_1SxHgEBDGilw48s7ccmMHgzb': { tier: 'gym', clientLimit: -1 },
  // Test prices (added via env vars or hardcoded for test mode)
  ...(process.env.STRIPE_PRICE_STARTER && { [process.env.STRIPE_PRICE_STARTER]: { tier: 'starter', clientLimit: 10 } }),
  ...(process.env.STRIPE_PRICE_PRO && { [process.env.STRIPE_PRICE_PRO]: { tier: 'pro', clientLimit: 30 } }),
  ...(process.env.STRIPE_PRICE_STUDIO && { [process.env.STRIPE_PRICE_STUDIO]: { tier: 'studio', clientLimit: 75 } }),
  ...(process.env.STRIPE_PRICE_GYM && { [process.env.STRIPE_PRICE_GYM]: { tier: 'gym', clientLimit: -1 } }),
};

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log(`Stripe webhook received: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutComplete(session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCanceled(subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`Payment succeeded for invoice ${invoice.id}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;
  const organizationId = session.metadata?.organization_id;

  if (!organizationId) {
    console.error('No organization_id in checkout session metadata');
    return;
  }

  // Get the subscription to check if it has a trial
  let subscriptionStatus = 'active';
  if (subscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      // If subscription is in trial, keep status as trialing
      if (sub.status === 'trialing') {
        subscriptionStatus = 'trialing';
      } else {
        subscriptionStatus = sub.status;
      }
    } catch (err) {
      console.error('Error retrieving subscription:', err);
    }
  }

  // Update organization with Stripe IDs
  const { error } = await supabase
    .from('organizations')
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      subscription_status: subscriptionStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', organizationId);

  if (error) {
    console.error('Error updating organization:', error);
  } else {
    console.log(`Organization ${organizationId} linked to Stripe customer ${customerId} (status: ${subscriptionStatus})`);
  }
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const priceId = subscription.items.data[0]?.price.id;
  const status = subscription.status;

  // Get tier config from price
  const tierConfig = TIER_CONFIG[priceId] || { tier: 'starter', clientLimit: 10 };

  // Find organization by stripe_customer_id
  const { data: org, error: findError } = await supabase
    .from('organizations')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (findError || !org) {
    console.error('Organization not found for customer:', customerId);
    return;
  }

  // Update subscription details
  const { error } = await supabase
    .from('organizations')
    .update({
      stripe_subscription_id: subscription.id,
      subscription_tier: tierConfig.tier,
      subscription_status: status,
      client_limit: tierConfig.clientLimit,
      updated_at: new Date().toISOString(),
    })
    .eq('id', org.id);

  if (error) {
    console.error('Error updating subscription:', error);
  } else {
    console.log(`Organization ${org.id} subscription updated: ${tierConfig.tier} (${status})`);
  }
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  // Find organization
  const { data: org } = await supabase
    .from('organizations')
    .select('id, subscription_status, trial_ends_at')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!org) {
    console.error('Organization not found for canceled subscription');
    return;
  }

  // Check if org is still in trial period
  const isStillInTrial = org.trial_ends_at && new Date(org.trial_ends_at) > new Date();
  
  if (isStillInTrial) {
    // Trial user cancelled plan selection - keep them as trialing
    // stripe_subscription_id was already cleared by our API
    console.log(`Organization ${org.id} cancelled plan selection during trial - keeping trialing status`);
    return;
  }

  // Mark as canceled but don't delete - they keep access until period ends
  const { error } = await supabase
    .from('organizations')
    .update({
      subscription_status: 'canceled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', org.id);

  if (error) {
    console.error('Error handling cancellation:', error);
  } else {
    console.log(`Organization ${org.id} subscription canceled`);
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  // Find organization
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!org) return;

  // Update status to past_due
  await supabase
    .from('organizations')
    .update({
      subscription_status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('id', org.id);

  console.log(`Organization ${org.id} payment failed - marked as past_due`);
}
// webhook test
