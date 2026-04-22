import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getAuthContext, unauthorized, forbidden, isTrainerRole } from '@/app/lib/auth-guard';


// Create SetupIntent for adding/updating payment method
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return unauthorized();
    if (!isTrainerRole(ctx.role)) return forbidden();

    const { organizationId } = await req.json();

    if (!organizationId) {
      return NextResponse.json({ error: 'Missing organization ID' }, { status: 400 });
    }

    if (ctx.role !== 'super_admin' && ctx.organizationId !== organizationId) {
      return forbidden();
    }

    // Get organization's Stripe customer ID
    const { data: org, error } = await getSupabaseAdmin()
      .from('organizations')
      .select('stripe_customer_id')
      .eq('id', organizationId)
      .single();

    if (error || !org?.stripe_customer_id) {
      return NextResponse.json({ error: 'No billing account found' }, { status: 404 });
    }

    // Create SetupIntent
    const setupIntent = await getStripe().setupIntents.create({
      customer: org.stripe_customer_id,
      payment_method_types: ['card'],
      usage: 'off_session', // For recurring payments
    });

    return NextResponse.json({ clientSecret: setupIntent.client_secret });
  } catch (error) {
    console.error('SetupIntent error:', error);
    return NextResponse.json({ error: 'Failed to create setup intent' }, { status: 500 });
  }
}
