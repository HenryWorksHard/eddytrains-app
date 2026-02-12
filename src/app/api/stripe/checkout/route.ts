import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Price IDs for each tier
const PRICE_IDS: Record<string, string> = {
  starter: process.env.STRIPE_PRICE_STARTER || 'price_1SxHgCBDGilw48s7lrc9Pjox',
  pro: process.env.STRIPE_PRICE_PRO || 'price_1SxHgDBDGilw48s7vI6lQPE6',
  studio: process.env.STRIPE_PRICE_STUDIO || 'price_1SxHgDBDGilw48s7hHTBfSGO',
  gym: process.env.STRIPE_PRICE_GYM || 'price_1SxHgEBDGilw48s7ccmMHgzb',
};

async function stripeRequest(endpoint: string, data: Record<string, string>, method: string = 'POST') {
  const response = await fetch(`https://api.stripe.com/v1/${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: method !== 'GET' ? new URLSearchParams(data).toString() : undefined,
  });
  return response.json();
}

async function stripeGet(endpoint: string) {
  const response = await fetch(`https://api.stripe.com/v1/${endpoint}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
    },
  });
  return response.json();
}

export async function POST(req: Request) {
  try {
    const { organizationId, tier, email } = await req.json();

    if (!organizationId || !tier || !email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const priceId = PRICE_IDS[tier];
    if (!priceId) {
      return NextResponse.json(
        { error: 'Invalid tier' },
        { status: 400 }
      );
    }

    // Check organization status including subscription info
    const { data: org } = await supabase
      .from('organizations')
      .select('stripe_customer_id, stripe_subscription_id, subscription_status, trial_ends_at, name')
      .eq('id', organizationId)
      .single();

    let customerId = org?.stripe_customer_id;

    // If organization has an existing subscription, update it directly
    if (org?.stripe_subscription_id) {
      const isTrialing = org?.subscription_status === 'trialing';
      console.log(`Updating existing ${isTrialing ? 'trial' : 'active'} subscription to new tier:`, tier);
      
      // Get the current subscription to find the item ID
      const subscription = await stripeGet(`subscriptions/${org.stripe_subscription_id}`);
      
      if (subscription.error) {
        console.error('Failed to get subscription:', subscription.error);
        return NextResponse.json(
          { error: 'Failed to get subscription', details: subscription.error.message },
          { status: 500 }
        );
      }

      // Update the subscription item to the new price
      const subscriptionItemId = subscription.items?.data?.[0]?.id;
      
      if (!subscriptionItemId) {
        return NextResponse.json(
          { error: 'No subscription item found' },
          { status: 500 }
        );
      }

      // For trialing: no proration (no charge yet)
      // For active: prorate immediately (charge/credit difference)
      const updateResult = await stripeRequest(`subscriptions/${org.stripe_subscription_id}`, {
        [`items[0][id]`]: subscriptionItemId,
        [`items[0][price]`]: priceId,
        proration_behavior: isTrialing ? 'none' : 'create_prorations',
      });

      if (updateResult.error) {
        console.error('Failed to update subscription:', updateResult.error);
        return NextResponse.json(
          { error: 'Failed to update subscription', details: updateResult.error.message },
          { status: 500 }
        );
      }

      // Update the tier in Supabase
      await supabase
        .from('organizations')
        .update({ subscription_tier: tier })
        .eq('id', organizationId);

      console.log('Successfully updated subscription to:', tier);

      // Return success - no checkout needed, subscription updated
      const message = isTrialing 
        ? `Plan updated to ${tier}. Billing will start when your trial ends.`
        : `Plan upgraded to ${tier}. Your billing has been adjusted.`;
      
      return NextResponse.json({ 
        success: true, 
        updated: true,
        message
      });
    }

    // Create new customer if needed
    if (!customerId) {
      const customer = await stripeRequest('customers', {
        email,
        'metadata[organization_id]': organizationId,
        'metadata[organization_name]': org?.name || '',
      });
      
      if (customer.error) {
        return NextResponse.json(
          { error: 'Failed to create customer', details: customer.error.message },
          { status: 500 }
        );
      }
      
      customerId = customer.id;

      // Save customer ID to organization
      await supabase
        .from('organizations')
        .update({ stripe_customer_id: customerId })
        .eq('id', organizationId);
    }

    // Create checkout session for embedded checkout
    // Use the request origin to ensure we return to the same domain (important for preview deployments)
    const requestUrl = new URL(req.url);
    const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;
    const returnUrl = `${baseUrl}/billing?session_id={CHECKOUT_SESSION_ID}`;
    
    console.log('Using price ID:', priceId, 'Return URL:', returnUrl);
    
    const sessionParams: Record<string, string> = {
      customer: customerId,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      mode: 'subscription',
      ui_mode: 'embedded',
      return_url: returnUrl,
      'metadata[organization_id]': organizationId,
      'subscription_data[metadata][organization_id]': organizationId,
    };

    // For trialing users, set trial_end so they're not charged until trial ends
    if (org?.subscription_status === 'trialing' && org?.trial_ends_at) {
      const trialEndTimestamp = Math.floor(new Date(org.trial_ends_at).getTime() / 1000);
      // Only set trial_end if it's in the future
      if (trialEndTimestamp > Math.floor(Date.now() / 1000)) {
        sessionParams['subscription_data[trial_end]'] = trialEndTimestamp.toString();
        console.log('Setting trial_end to:', org.trial_ends_at);
      }
    }
    
    console.log('Creating embedded checkout session with params:', JSON.stringify(sessionParams));
    
    const session = await stripeRequest('checkout/sessions', sessionParams);

    if (session.error) {
      console.error('Stripe error:', JSON.stringify(session.error));
      return NextResponse.json(
        { error: 'Failed to create checkout', details: session.error.message, code: session.error.code },
        { status: 500 }
      );
    }

    // Return client_secret for embedded checkout
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
