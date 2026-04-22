import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

import { getStripe } from '@/lib/stripe';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getAuthContext, unauthorized, forbidden, isTrainerRole } from '@/app/lib/auth-guard';

// Price IDs for each tier
const PRICE_IDS: Record<string, string> = {
  starter: process.env.STRIPE_PRICE_STARTER || 'price_1SxHgCBDGilw48s7lrc9Pjox',
  pro: process.env.STRIPE_PRICE_PRO || 'price_1SxHgDBDGilw48s7vI6lQPE6',
  studio: process.env.STRIPE_PRICE_STUDIO || 'price_1SxHgDBDGilw48s7hHTBfSGO',
  gym: process.env.STRIPE_PRICE_GYM || 'price_1SxHgEBDGilw48s7ccmMHgzb',
};

export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return unauthorized();
    if (!isTrainerRole(ctx.role)) return forbidden();

    const { organizationId, tier, email } = await req.json();

    if (!organizationId || !tier || !email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Caller must be in the target org (or super_admin).
    if (ctx.role !== 'super_admin' && ctx.organizationId !== organizationId) {
      return forbidden();
    }

    const priceId = PRICE_IDS[tier];
    if (!priceId) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
    }

    const stripe = getStripe();

    // Check organization status including subscription info
    const { data: org } = await getSupabaseAdmin()
      .from('organizations')
      .select('stripe_customer_id, stripe_subscription_id, subscription_status, trial_ends_at, name')
      .eq('id', organizationId)
      .single();

    let customerId = org?.stripe_customer_id;

    // If organization has an existing subscription, update it directly
    if (org?.stripe_subscription_id) {
      const isTrialing = org?.subscription_status === 'trialing';

      const subscription = await stripe.subscriptions.retrieve(org.stripe_subscription_id);
      const subscriptionItemId = subscription.items?.data?.[0]?.id;

      if (!subscriptionItemId) {
        return NextResponse.json(
          { error: 'No subscription item found' },
          { status: 500 }
        );
      }

      await stripe.subscriptions.update(org.stripe_subscription_id, {
        items: [{ id: subscriptionItemId, price: priceId }],
        proration_behavior: isTrialing ? 'none' : 'create_prorations',
      });

      await getSupabaseAdmin()
        .from('organizations')
        .update({ subscription_tier: tier })
        .eq('id', organizationId);

      const message = isTrialing
        ? `Plan updated to ${tier}. Billing will start when your trial ends.`
        : `Plan upgraded to ${tier}. Your billing has been adjusted.`;

      return NextResponse.json({ success: true, updated: true, message });
    }

    // Create new customer if needed
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: {
          organization_id: organizationId,
          organization_name: org?.name || '',
        },
      });
      customerId = customer.id;

      await getSupabaseAdmin()
        .from('organizations')
        .update({ stripe_customer_id: customerId })
        .eq('id', organizationId);
    }

    const requestUrl = new URL(req.url);
    const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;
    const returnUrl = `${baseUrl}/billing?session_id={CHECKOUT_SESSION_ID}`;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      ui_mode: 'embedded',
      return_url: returnUrl,
      metadata: { organization_id: organizationId },
      subscription_data: {
        metadata: { organization_id: organizationId },
      },
    };

    if (org?.subscription_status === 'trialing' && org?.trial_ends_at) {
      const trialEndTimestamp = Math.floor(new Date(org.trial_ends_at).getTime() / 1000);
      if (trialEndTimestamp > Math.floor(Date.now() / 1000)) {
        sessionParams.subscription_data = {
          ...(sessionParams.subscription_data || {}),
          trial_end: trialEndTimestamp,
        };
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({ clientSecret: session.client_secret });
  } catch (error) {
    console.error('Checkout error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to create checkout session', details: errorMessage },
      { status: 500 }
    );
  }
}
