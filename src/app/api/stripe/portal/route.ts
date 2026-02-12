import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';

import { getSupabaseAdmin } from '@/lib/supabase-admin';


export async function POST(req: Request) {
  try {
    const { organizationId } = await req.json();

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Missing organization ID' },
        { status: 400 }
      );
    }

    // Get organization's Stripe customer ID
    const { data: org, error } = await getSupabaseAdmin()
      .from('organizations')
      .select('stripe_customer_id')
      .eq('id', organizationId)
      .single();

    if (error || !org?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No billing account found' },
        { status: 404 }
      );
    }

    // Create billing portal session
    const returnUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://eddytrains-admin.vercel.app';
    const session = await getStripe().billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${returnUrl}/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Portal error:', error);
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    );
  }
}
