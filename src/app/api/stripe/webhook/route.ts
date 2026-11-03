import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';

import { getSupabaseAdmin } from '@/lib/supabase-admin';


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
    event = getStripe().webhooks.constructEvent(
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
  // A one-time program purchase from the website. Handled first and returned,
  // because everything below this point is about trainer subscriptions and
  // would reject it for having no organization_id.
  const programSlug = session.metadata?.program_slug;
  if (session.mode === 'payment' && programSlug) {
    await handleProgramPurchase(session, programSlug);
    return;
  }

  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;
  const organizationId = session.metadata?.organization_id;

  // Provisioning model (post 2026-05-28 self-serve signup):
  //   1. Trainer self-signs at /signup  → /api/signup creates the auth user
  //      + organization + profile + Stripe customer (with metadata.signup=true)
  //      + invite_token. Org has stripe_customer_id but NO subscription.
  //   2. Day 14 trial-end: trainer adds a card via /api/stripe/trial-checkout
  //      which creates a Checkout session with metadata.organization_id.
  //   3. Stripe fires checkout.session.completed → this handler runs and
  //      attaches the resulting subscription to the existing org.
  // So organization_id will ALWAYS be present in metadata for legitimate
  // checkout sessions originating from our app. If it's missing, the session
  // was triggered some other way (manual Stripe dashboard test, etc.) — log
  // and ignore.
  if (!organizationId) {
    console.error('[webhook] checkout.session.completed without organization_id metadata — ignoring', {
      sessionId: session.id,
      customerId,
    });
    return;
  }

  // Get the subscription to check if it has a trial
  let subscriptionStatus = 'active';
  if (subscriptionId) {
    try {
      const sub = await getStripe().subscriptions.retrieve(subscriptionId);
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
  const { error } = await getSupabaseAdmin()
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

  // Find organization by stripe_customer_id. We expect this to exist
  // because /api/signup creates the Stripe customer + sets the org's
  // stripe_customer_id BEFORE any subscription event can fire. If it's
  // missing, the customer was created externally (manual Stripe dashboard,
  // legacy data, etc.) — log loudly and ignore so we don't accidentally
  // create a phantom org.
  const { data: org, error: findError } = await getSupabaseAdmin()
    .from('organizations')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (findError || !org) {
    console.error('[webhook] subscription update for unknown customer — ignoring', {
      customerId,
      subscriptionId: subscription.id,
      status,
    });
    return;
  }

  // Update subscription details
  const { error } = await getSupabaseAdmin()
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
  const { data: org } = await getSupabaseAdmin()
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
  const { error } = await getSupabaseAdmin()
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
  const { data: org } = await getSupabaseAdmin()
    .from('organizations')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!org) return;

  // Update status to past_due
  await getSupabaseAdmin()
    .from('organizations')
    .update({
      subscription_status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('id', org.id);

  console.log(`Organization ${org.id} payment failed - marked as past_due`);
}
// webhook test

/**
 * Someone bought a program on cmpdcollective.com.
 *
 * Stripe has their money and their email. This turns that into an account
 * with the program on it for the right window, and a link to set a password.
 *
 * Throwing here makes Stripe retry, which is what we want for a transient
 * database failure and emphatically not what we want once the program has
 * been granted — so fulfilment is written to be safe to run twice and the
 * email failure inside it is swallowed rather than raised.
 */
async function handleProgramPurchase(session: Stripe.Checkout.Session, slug: string) {
  const email =
    session.customer_details?.email ?? session.customer_email ?? null;

  if (!email) {
    console.error('[webhook] program purchase with no email — cannot fulfil', {
      sessionId: session.id,
      slug,
    });
    return;
  }

  // Stripe reports the paid date in seconds.
  const purchaseDate = new Date((session.created ?? Date.now() / 1000) * 1000)
    .toISOString()
    .slice(0, 10);

  const { fulfilProgramPurchase } = await import('@/app/lib/fulfil-purchase');
  const result = await fulfilProgramPurchase(getSupabaseAdmin(), {
    email,
    fullName: session.customer_details?.name ?? null,
    slug,
    purchaseDate,
  });

  if (!result.ok) {
    // Logged with everything needed to finish it by hand, then rethrown so
    // Stripe retries rather than marking a paid order delivered.
    console.error('[webhook] program purchase could not be fulfilled', {
      sessionId: session.id,
      email,
      slug,
      error: result.error,
    });
    throw new Error(`Fulfilment failed: ${result.error}`);
  }

  console.log('[webhook] program purchase fulfilled', {
    sessionId: session.id,
    slug,
    clientId: result.clientId,
    newAccount: result.created,
    access: `${result.start_date} to ${result.end_date}`,
    alreadyHad: result.alreadyHad ?? false,
  });
}
