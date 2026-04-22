import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getAuthContext, unauthorized, forbidden, isTrainerRole } from '@/app/lib/auth-guard';

export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return unauthorized();
    if (!isTrainerRole(ctx.role)) return forbidden();

    const { organization_id, email, role } = await req.json();

    // Caller must be in the target org (or super_admin).
    if (ctx.role !== 'super_admin' && ctx.organizationId !== organization_id) {
      return forbidden();
    }

    if (!organization_id || !email || !role) {
      return NextResponse.json(
        { error: 'organization_id, email, and role are required' },
        { status: 400 }
      );
    }

    // Validate role
    if (!['admin', 'trainer'].includes(role)) {
      return NextResponse.json(
        { error: 'Role must be admin or trainer' },
        { status: 400 }
      );
    }

    // Check if org exists and get max_trainers
    const { data: org, error: orgError } = await getSupabaseAdmin()
      .from('organizations')
      .select('id, name, max_trainers')
      .eq('id', organization_id)
      .single();

    if (orgError || !org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Check trainer limit
    if (org.max_trainers !== -1) {
      const { count } = await getSupabaseAdmin()
        .from('organization_members')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organization_id)
        .eq('is_active', true);

      if (count && count >= org.max_trainers) {
        return NextResponse.json(
          { error: 'Trainer limit reached. Upgrade your plan to add more trainers.' },
          { status: 400 }
        );
      }
    }

    // Check if user already exists
    const { data: existingProfile } = await getSupabaseAdmin()
      .from('profiles')
      .select('id, organization_id')
      .eq('email', email)
      .single();

    if (existingProfile?.organization_id === organization_id) {
      return NextResponse.json(
        { error: 'This user is already a member of your organization' },
        { status: 400 }
      );
    }

    // Check for existing pending invite
    const { data: existingInvite } = await getSupabaseAdmin()
      .from('organization_invites')
      .select('id')
      .eq('organization_id', organization_id)
      .eq('email', email)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (existingInvite) {
      return NextResponse.json(
        { error: 'An invitation has already been sent to this email' },
        { status: 400 }
      );
    }

    // Generate invite token
    const token = crypto.randomUUID() + '-' + crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    // Create invite
    const { data: invite, error: inviteError } = await getSupabaseAdmin()
      .from('organization_invites')
      .insert({
        organization_id,
        email,
        role,
        token,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (inviteError) {
      console.error('Invite creation error:', inviteError);
      return NextResponse.json(
        { error: 'Failed to create invitation' },
        { status: 500 }
      );
    }

    // TODO: Send email with invite link
    // For now, the invite link would be: 
    // {app_url}/join?token={token}
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.cmpdcollective.com'}/join?token=${token}`;
    
    console.log('Invite created:', { email, inviteUrl });

    // TODO: wire this trainer-invite flow through Resend (sendInviteEmail in @/app/lib/email)
    // once we extend the invite_tokens pattern to non-client roles.

    return NextResponse.json({
      success: true,
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        created_at: invite.created_at,
        expires_at: invite.expires_at,
      },
      inviteUrl, // Remove this in production
    });
  } catch (error) {
    console.error('Invite error:', error);
    return NextResponse.json(
      { error: 'Failed to send invitation' },
      { status: 500 }
    );
  }
}

// Accept invitation
export async function PUT(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return unauthorized();

    const { token } = await req.json();
    // Bind user_id server-side to the authenticated caller. Ignore anything in the body.
    const user_id = ctx.userId;

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Find the invite
    const { data: invite, error: inviteError } = await getSupabaseAdmin()
      .from('organization_invites')
      .select('*')
      .eq('token', token)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (inviteError || !invite) {
      return NextResponse.json(
        { error: 'Invalid or expired invitation' },
        { status: 400 }
      );
    }

    // Add user to organization_members
    const { error: memberError } = await getSupabaseAdmin()
      .from('organization_members')
      .insert({
        organization_id: invite.organization_id,
        user_id,
        role: invite.role,
        invited_by: invite.invited_by,
        invited_at: invite.created_at,
        joined_at: new Date().toISOString(),
        is_active: true,
      });

    if (memberError) {
      console.error('Member creation error:', memberError);
      return NextResponse.json(
        { error: 'Failed to add to organization' },
        { status: 500 }
      );
    }

    // Update user's profile with organization_id
    await getSupabaseAdmin()
      .from('profiles')
      .update({ 
        organization_id: invite.organization_id,
        role: 'trainer',
      })
      .eq('id', user_id);

    // Mark invite as accepted
    await getSupabaseAdmin()
      .from('organization_invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id);

    return NextResponse.json({
      success: true,
      organization_id: invite.organization_id,
    });
  } catch (error) {
    console.error('Accept invite error:', error);
    return NextResponse.json(
      { error: 'Failed to accept invitation' },
      { status: 500 }
    );
  }
}
