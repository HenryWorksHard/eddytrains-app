import { NextResponse } from 'next/server';

import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getAuthContext, unauthorized, forbidden, isTrainerRole } from '@/app/lib/auth-guard';

// Generate URL-safe slug from business name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return unauthorized();
    if (!isTrainerRole(ctx.role)) return forbidden();

    const { name } = await req.json();

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Bind owner to the caller. Ignore any owner_id / tier / limit from the body.
    const owner_id = ctx.userId;
    const owner_email = ctx.email;

    // Generate unique slug
    let slug = generateSlug(name);
    const { data: existing } = await getSupabaseAdmin()
      .from('organizations')
      .select('slug')
      .eq('slug', slug)
      .single();

    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    // Calculate trial end date (14 days from now)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    // Create organization with safe defaults. Stripe webhook is the source of
    // truth for subscription_tier / client_limit after signup.
    const { data: org, error: orgError } = await getSupabaseAdmin()
      .from('organizations')
      .insert({
        name,
        slug,
        owner_id,
        subscription_tier: 'gym', // Full access during 14-day trial
        subscription_status: 'trialing',
        client_limit: -1, // Unlimited during trial
        trial_ends_at: trialEndsAt.toISOString(),
      })
      .select()
      .single();

    if (orgError) {
      console.error('Org creation error:', orgError);
      return NextResponse.json(
        { error: 'Failed to create organization' },
        { status: 500 }
      );
    }

    // Update the owner's profile with organization_id and trainer role
    const { error: profileError } = await getSupabaseAdmin()
      .from('profiles')
      .upsert({
        id: owner_id,
        email: owner_email,
        organization_id: org.id,
        role: 'trainer',
        is_active: true,
      });

    if (profileError) {
      console.error('Profile update error:', profileError);
      // Don't fail the whole request, org was created
    }

    return NextResponse.json({
      success: true,
      organization: org,
    });
  } catch (error) {
    console.error('Organization creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create organization' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return unauthorized();

    const { searchParams } = new URL(req.url);
    const ownerId = searchParams.get('owner_id');

    if (ownerId) {
      // Allow if caller is that owner, or super_admin.
      if (ctx.role !== 'super_admin' && ctx.userId !== ownerId) {
        return forbidden();
      }

      const { data: profile } = await getSupabaseAdmin()
        .from('profiles')
        .select('organization_id')
        .eq('id', ownerId)
        .single();

      if (!profile?.organization_id) {
        return NextResponse.json({ organization: null });
      }

      const { data: org } = await getSupabaseAdmin()
        .from('organizations')
        .select('*')
        .eq('id', profile.organization_id)
        .single();

      return NextResponse.json({ organization: org });
    }

    // Listing all orgs is super_admin only.
    if (ctx.role !== 'super_admin') return forbidden();

    const { data: orgs, error } = await getSupabaseAdmin()
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch owner profiles separately (including role to filter out super_admins)
    const ownerIds = orgs?.map(o => o.owner_id).filter(Boolean) || [];
    const { data: profiles } = await getSupabaseAdmin()
      .from('profiles')
      .select('id, email, full_name, role')
      .in('id', ownerIds);

    // Filter out organizations owned by super_admins (platform admin orgs)
    const trainerOrgs = orgs?.filter(org => {
      const ownerProfile = profiles?.find(p => p.id === org.owner_id);
      return ownerProfile?.role !== 'super_admin';
    });

    // Attach profiles to orgs
    const orgsWithProfiles = trainerOrgs?.map(org => ({
      ...org,
      profiles: profiles?.filter(p => p.id === org.owner_id) || []
    }));

    return NextResponse.json({ organizations: orgsWithProfiles });
  } catch (error) {
    console.error('Get organizations error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    );
  }
}
