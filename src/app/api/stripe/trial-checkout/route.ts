import { NextResponse } from 'next/server';

import { getStripe } from '@/lib/stripe';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getAuthContext, unauthorized, forbidden, isTrainerRole } from '@/app/lib/auth-guard';

const STARTER_PRICE_ID = process.env.STRIPE_PRICE_STARTER || 'price_1SxHgCBDGilw48s7lrc9Pjox';

export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return unauthorized();
    if (!isTrainerRole(ctx.role)) return forbidden();

    const { organizationId, email, organizationName } = await req.json();

    if (!organizationId || !email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (ctx.role !== 'super_admin' && ctx.organizationId !== organizationId) {
      return forbidden();
    }

    const stripe = getStripe();

    const { data: org } = await getSupabaseAdmin()
      .from('organizations')
      .select('stripe_customer_id, name')
      .eq('id', organizationId)
      .single();

    let customerId = org?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: {
          organization_id: organizationId,
          organization_name: organizationName || org?.name || '',
        },
      });
      customerId = customer.id;

      await getSupabaseAdmin()
        .from('organizations')
        .update({ stripe_customer_id: customerId })
        .eq('id', organizationId);
    }

    const successUrl = 'https://eddytrains-admin.vercel.app/dashboard?welcome=true';
    const cancelUrl = 'https://eddytrains-admin.vercel.app/signup?canceled=true';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: STARTER_PRICE_ID, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { organization_id: organizationId },
      subscription_data: {
        metadata: { organization_id: organizationId },
        trial_period_days: 14,
      },
    });

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
