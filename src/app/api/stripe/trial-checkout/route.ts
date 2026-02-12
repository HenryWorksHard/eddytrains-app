import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Price IDs for each tier (using Starter for trial)
const STARTER_PRICE_ID = 'price_1SxHgCBDGilw48s7lrc9Pjox';

async function stripeRequest(endpoint: string, data: Record<string, string>) {
  const response = await fetch(`https://api.stripe.com/v1/${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(data).toString(),
  });
  return response.json();
}

export async function POST(req: Request) {
  try {
    const { organizationId, email, organizationName } = await req.json();

    if (!organizationId || !email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if organization already has a Stripe customer
    const { data: org } = await supabase
      .from('organizations')
      .select('stripe_customer_id, name')
      .eq('id', organizationId)
      .single();

    let customerId = org?.stripe_customer_id;

    // Create new customer if needed
    if (!customerId) {
      const customer = await stripeRequest('customers', {
        email,
        'metadata[organization_id]': organizationId,
        'metadata[organization_name]': organizationName || org?.name || '',
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

    // Create checkout session with 14-day trial
    const successUrl = 'https://eddytrains-admin.vercel.app/dashboard?welcome=true';
    const cancelUrl = 'https://eddytrains-admin.vercel.app/signup?canceled=true';
    
    const sessionParams: Record<string, string> = {
      customer: customerId,
      'payment_method_types[0]': 'card',
      'line_items[0][price]': STARTER_PRICE_ID,
      'line_items[0][quantity]': '1',
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      'metadata[organization_id]': organizationId,
      'subscription_data[metadata][organization_id]': organizationId,
      'subscription_data[trial_period_days]': '14',
    };
    
    const session = await stripeRequest('checkout/sessions', sessionParams);

    if (session.error) {
      console.error('Stripe error:', JSON.stringify(session.error));
      return NextResponse.json(
        { error: 'Failed to create checkout', details: session.error.message, code: session.error.code },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Trial checkout error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to create trial checkout session', details: errorMessage },
      { status: 500 }
    );
  }
}
