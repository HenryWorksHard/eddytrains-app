import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { createClient as createServerClient } from '@/app/lib/supabase/server';
import { cookies } from 'next/headers';
import { IMPERSONATION_COOKIE } from '@/app/lib/org-context';

/**
 * Authorize that the current session may act on the given organization.
 * Rules:
 *   - super_admin: always allowed
 *   - Otherwise: caller must belong to that organization
 *   - Impersonation cookie is ONLY honored for super_admin
 */
async function authorize(organizationId: string) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, status: 401, error: 'Not authenticated' };
  }

  const admin = getSupabaseAdmin();
  const { data: profile } = await admin
    .from('profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return { ok: false as const, status: 403, error: 'Profile not found' };
  }

  if (profile.role === 'super_admin') {
    return { ok: true as const, role: profile.role, userOrgId: profile.organization_id };
  }

  // Honor impersonation only for super_admins (already returned above)
  const cookieStore = await cookies();
  const impersonatingOrgId = cookieStore.get(IMPERSONATION_COOKIE)?.value;
  const effectiveOrgId = impersonatingOrgId && profile.role === 'super_admin'
    ? impersonatingOrgId
    : profile.organization_id;

  if (effectiveOrgId !== organizationId) {
    return { ok: false as const, status: 403, error: 'Not authorized for this organization' };
  }

  return { ok: true as const, role: profile.role, userOrgId: profile.organization_id };
}

// GET - Fetch subscription details
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json({ error: 'Missing organization ID' }, { status: 400 });
    }

    const authResult = await authorize(organizationId);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    // Get organization's Stripe IDs
    const { data: org, error } = await getSupabaseAdmin()
      .from('organizations')
      .select('stripe_customer_id, stripe_subscription_id, subscription_tier, subscription_status, trial_ends_at')
      .eq('id', organizationId)
      .single();

    if (error || !org?.stripe_customer_id) {
      return NextResponse.json({ error: 'No billing account found' }, { status: 404 });
    }

    let subscription = null;
    let paymentMethod = null;
    let invoices: unknown[] = [];

    // Get subscription details if exists
    if (org.stripe_subscription_id) {
      const subResponse = await getStripe().subscriptions.retrieve(org.stripe_subscription_id, {
        expand: ['default_payment_method', 'latest_invoice'],
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sub = subResponse as any;

      subscription = {
        id: sub.id,
        status: sub.status,
        currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
        currentPeriodStart: new Date(sub.current_period_start * 1000).toISOString(),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null,
        trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
        priceId: sub.items.data[0]?.price.id,
        amount: sub.items.data[0]?.price.unit_amount,
        interval: sub.items.data[0]?.price.recurring?.interval,
      };

      if (sub.default_payment_method && typeof sub.default_payment_method === 'object') {
        const pm = sub.default_payment_method;
        if (pm.card) {
          paymentMethod = {
            id: pm.id,
            brand: pm.card.brand,
            last4: pm.card.last4,
            expMonth: pm.card.exp_month,
            expYear: pm.card.exp_year,
          };
        }
      }
    }

    if (!paymentMethod) {
      const customer = await getStripe().customers.retrieve(org.stripe_customer_id) as Stripe.Customer;
      if (customer.invoice_settings?.default_payment_method) {
        const pm = await getStripe().paymentMethods.retrieve(
          customer.invoice_settings.default_payment_method as string
        );
        if (pm.card) {
          paymentMethod = {
            id: pm.id,
            brand: pm.card.brand,
            last4: pm.card.last4,
            expMonth: pm.card.exp_month,
            expYear: pm.card.exp_year,
          };
        }
      }
    }

    const invoiceList = await getStripe().invoices.list({
      customer: org.stripe_customer_id,
      limit: 10,
    });

    invoices = invoiceList.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      status: inv.status,
      amount: inv.amount_paid,
      currency: inv.currency,
      created: new Date(inv.created * 1000).toISOString(),
      hostedUrl: inv.hosted_invoice_url,
      pdfUrl: inv.invoice_pdf,
    }));

    return NextResponse.json({
      subscription,
      paymentMethod,
      invoices,
      tier: org.subscription_tier,
      status: org.subscription_status,
      trialEndsAt: org.trial_ends_at,
    });
  } catch (error) {
    console.error('Subscription fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 });
  }
}

// POST - Update payment method / cancel / reactivate
export async function POST(req: Request) {
  try {
    const { organizationId, action, paymentMethodId } = await req.json();

    if (!organizationId) {
      return NextResponse.json({ error: 'Missing organization ID' }, { status: 400 });
    }

    const authResult = await authorize(organizationId);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { data: org, error } = await getSupabaseAdmin()
      .from('organizations')
      .select('stripe_customer_id, stripe_subscription_id, subscription_status')
      .eq('id', organizationId)
      .single();

    if (error || !org?.stripe_customer_id) {
      return NextResponse.json({ error: 'No billing account found' }, { status: 404 });
    }

    if (action === 'update_payment_method' && paymentMethodId) {
      await getStripe().paymentMethods.attach(paymentMethodId, {
        customer: org.stripe_customer_id,
      });

      await getStripe().customers.update(org.stripe_customer_id, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });

      if (org.stripe_subscription_id) {
        await getStripe().subscriptions.update(org.stripe_subscription_id, {
          default_payment_method: paymentMethodId,
        });
      }

      return NextResponse.json({ success: true, message: 'Payment method updated' });
    }

    if (action === 'cancel') {
      if (!org.stripe_subscription_id) {
        return NextResponse.json({ error: 'No active subscription' }, { status: 400 });
      }

      if (org.subscription_status === 'trialing') {
        await getStripe().subscriptions.cancel(org.stripe_subscription_id);

        await getSupabaseAdmin()
          .from('organizations')
          .update({
            stripe_subscription_id: null,
            subscription_tier: 'gym'
          })
          .eq('id', organizationId);

        return NextResponse.json({
          success: true,
          cleared: true,
          message: 'Plan selection cancelled. You can select a new plan anytime before your trial ends.'
        });
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updatedSub = await getStripe().subscriptions.update(org.stripe_subscription_id, {
          cancel_at_period_end: true,
        }) as any;

        const periodEnd = updatedSub.current_period_end
          ? new Date(updatedSub.current_period_end * 1000).toISOString()
          : null;

        await getSupabaseAdmin()
          .from('organizations')
          .update({
            subscription_status: 'canceling',
            trial_ends_at: periodEnd,
            updated_at: new Date().toISOString(),
          })
          .eq('id', organizationId);

        return NextResponse.json({
          success: true,
          message: 'Subscription will cancel at period end',
          periodEnd,
        });
      }
    }

    if (action === 'reactivate') {
      if (!org.stripe_subscription_id) {
        return NextResponse.json({ error: 'No subscription to reactivate' }, { status: 400 });
      }

      await getStripe().subscriptions.update(org.stripe_subscription_id, {
        cancel_at_period_end: false,
      });

      await getSupabaseAdmin()
        .from('organizations')
        .update({
          subscription_status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', organizationId);

      return NextResponse.json({ success: true, message: 'Subscription reactivated' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Subscription action error:', error);
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}

// DELETE - Immediately cancel subscription
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json({ error: 'Missing organization ID' }, { status: 400 });
    }

    const authResult = await authorize(organizationId);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { data: org, error } = await getSupabaseAdmin()
      .from('organizations')
      .select('stripe_subscription_id')
      .eq('id', organizationId)
      .single();

    if (error || !org?.stripe_subscription_id) {
      return NextResponse.json({ error: 'No active subscription' }, { status: 404 });
    }

    await getStripe().subscriptions.cancel(org.stripe_subscription_id);

    await getSupabaseAdmin()
      .from('organizations')
      .update({
        subscription_status: 'canceled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', organizationId);

    return NextResponse.json({ success: true, message: 'Subscription canceled' });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 });
  }
}
