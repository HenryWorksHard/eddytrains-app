import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    const { name, owner_id, owner_email, owner_name } = await req.json();

    if (!name || !owner_id) {
      return NextResponse.json(
        { error: 'Name and owner_id are required' },
        { status: 400 }
      );
    }

    // Generate unique slug
    let slug = generateSlug(name);
    const { data: existing } = await supabase
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

    // Create organization
    // During trial: full access (gym tier, unlimited clients)
    // User picks their plan when trial ends or when they subscribe
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name,
        slug,
        owner_id,
        subscription_tier: 'gym', // Full access during trial
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
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: owner_id,
        email: owner_email,
        full_name: owner_name,
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
    const { searchParams } = new URL(req.url);
    const ownerId = searchParams.get('owner_id');

    if (ownerId) {
      // Get organization for specific owner
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', ownerId)
        .single();

      if (!profile?.organization_id) {
        return NextResponse.json({ organization: null });
      }

      const { data: org } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', profile.organization_id)
        .single();

      return NextResponse.json({ organization: org });
    }

    // List all organizations (super_admin only - add auth check in production)
    const { data: orgs, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch owner profiles separately (including role to filter out super_admins)
    const ownerIds = orgs?.map(o => o.owner_id).filter(Boolean) || [];
    const { data: profiles } = await supabase
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
