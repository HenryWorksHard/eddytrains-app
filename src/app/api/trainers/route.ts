import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create admin client with service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TIER_CLIENT_LIMITS: Record<string, number> = {
  starter: 10,
  pro: 30,
  studio: 75,
  gym: -1, // unlimited
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, fullName, orgName, orgSlug, accessType, expiryDate, tier, customMonthlyPrice } = body;

    // Validate required fields
    if (!email || !password || !fullName || !orgName || !orgSlug) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Validate custom expiry date if selected
    if (accessType === 'custom' && !expiryDate) {
      return NextResponse.json(
        { error: 'Expiry date is required for custom access' },
        { status: 400 }
      );
    }

    // Check if slug is already taken
    const { data: existingOrg } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('slug', orgSlug)
      .single();

    if (existingOrg) {
      return NextResponse.json(
        { error: 'Organization slug already taken' },
        { status: 400 }
      );
    }

    // Create the user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
    });

    if (authError) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    const userId = authData.user.id;

    // Determine subscription status and trial_ends_at based on access type
    let subscriptionStatus = 'trialing';
    let trialEndsAt: string | null = null;

    if (accessType === 'lifetime') {
      subscriptionStatus = 'active';
      // Set trial_ends_at far in the future for lifetime (100 years)
      const farFuture = new Date();
      farFuture.setFullYear(farFuture.getFullYear() + 100);
      trialEndsAt = farFuture.toISOString();
    } else if (accessType === 'custom') {
      // Custom expiry - still shows as trialing with countdown to custom date
      subscriptionStatus = 'trialing';
      trialEndsAt = new Date(expiryDate).toISOString();
    } else {
      // Trial - 14 days from now
      subscriptionStatus = 'trialing';
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 14);
      trialEndsAt = trialEnd.toISOString();
    }

    // Create the organization
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: orgName,
        slug: orgSlug,
        owner_id: userId,
        subscription_tier: tier || 'starter',
        subscription_status: subscriptionStatus,
        trial_ends_at: trialEndsAt,
        client_limit: TIER_CLIENT_LIMITS[tier || 'starter'],
        custom_monthly_price: customMonthlyPrice ? parseInt(customMonthlyPrice) : null,
      })
      .select()
      .single();

    if (orgError) {
      console.error('Org error:', orgError);
      // Clean up: delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: 'Failed to create organization' },
        { status: 500 }
      );
    }

    // Create/update the profile with trainer role and org
    // Using upsert because the profile trigger might not fire for admin-created users
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        email: email,
        role: 'trainer',
        full_name: fullName,
        organization_id: org.id,
        is_active: true,
      });

    if (profileError) {
      console.error('Profile error:', profileError);
      // Note: Not cleaning up here as user/org are created
    }

    return NextResponse.json({
      success: true,
      trainer: {
        id: userId,
        email,
        fullName,
        organization: org,
      },
    });
  } catch (error) {
    console.error('Error creating trainer:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
