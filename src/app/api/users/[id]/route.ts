import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, unauthorized, forbidden, canAccessUser, isTrainerRole } from '@/app/lib/auth-guard'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

// Resolve slug, email, or UUID to profile
async function resolveProfile(adminClient: ReturnType<typeof getAdminClient>, identifier: string) {
  const decoded = decodeURIComponent(identifier)

  // Determine lookup field: email has @, UUID has dashes, otherwise it's a slug
  let lookupField: string
  if (decoded.includes('@')) {
    lookupField = 'email'
  } else if (decoded.includes('-') && decoded.length === 36) {
    lookupField = 'id'
  } else {
    lookupField = 'slug'
  }

  const { data: profile, error } = await adminClient
    .from('profiles')
    .select('*')
    .eq(lookupField, decoded)
    .single()

  return { profile, error, lookupField }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return unauthorized()

    const { id } = await params
    const adminClient = getAdminClient()

    const { profile, error: profileError, lookupField } = await resolveProfile(adminClient, id)

    if (profileError || !profile) {
      return NextResponse.json({
        error: 'User not found',
        details: profileError?.message,
        lookupField,
        lookupValue: decodeURIComponent(id)
      }, { status: 404 })
    }

    if (!canAccessUser(ctx, { id: profile.id, organization_id: profile.organization_id })) {
      return forbidden()
    }

    const { data: authUser } = await adminClient.auth.admin.getUserById(profile.id)

    return NextResponse.json({
      user: {
        ...profile,
        email: authUser?.user?.email || profile.email || 'Unknown',
        user_permissions: [{
          can_access_strength: profile.can_access_strength,
          can_access_cardio: profile.can_access_cardio,
          can_access_hyrox: profile.can_access_hyrox,
          can_access_hybrid: profile.can_access_hybrid
        }]
      }
    })
  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json({
      error: 'Failed to fetch user',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return unauthorized()

    const { id } = await params
    const body = await request.json()
    const { full_name, email, permissions, role: newRole } = body
    const adminClient = getAdminClient()

    const { profile, error: lookupError } = await resolveProfile(adminClient, id)
    if (lookupError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!canAccessUser(ctx, { id: profile.id, organization_id: profile.organization_id })) {
      return forbidden()
    }

    const userId = profile.id
    const callerIsTrainer = isTrainerRole(ctx.role)

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    if (full_name !== undefined) updateData.full_name = full_name

    // Only trainer-role callers can change email; clients self-editing cannot.
    if (email !== undefined) {
      if (!callerIsTrainer) return forbidden()
      updateData.email = email
    }

    // Role changes: only trainer-role+. (Still don't let a trainer escalate
    // to super_admin.) Audit fix (2026-08-23): previously the super_admin
    // check was the ONLY escalation guard, so a trainer editing their own
    // profile could set role='company_admin' or 'admin' — an intra-tier
    // self-promotion. Also block any self-role-change entirely; role
    // transitions must come from a different admin.
    if (newRole !== undefined) {
      if (!callerIsTrainer) return forbidden()
      if (newRole === 'super_admin' && ctx.role !== 'super_admin') return forbidden()
      if (ctx.userId === userId) {
        return NextResponse.json(
          { error: 'You cannot change your own role. Ask another admin.' },
          { status: 403 }
        )
      }
      // Whitelist allowed roles so bogus values can't be written.
      const allowedRoles = ['client', 'trainer', 'admin', 'company_admin', 'super_admin']
      if (!allowedRoles.includes(newRole)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
      }
      updateData.role = newRole
    }

    // Permissions: only trainer-role+.
    if (permissions) {
      if (!callerIsTrainer) return forbidden()
      const hasPrograms = permissions.programs || false
      updateData.can_access_strength = hasPrograms
      updateData.can_access_cardio = hasPrograms
      updateData.can_access_hyrox = hasPrograms
      updateData.can_access_hybrid = hasPrograms
      updateData.can_access_nutrition = permissions.nutrition || false
    }

    const { error: profileError } = await adminClient
      .from('profiles')
      .update(updateData)
      .eq('id', userId)

    if (profileError) throw profileError

    if (email && email !== profile.email) {
      await adminClient.auth.admin.updateUserById(userId, { email })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update user error:', error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return unauthorized()

    const { id } = await params
    const adminClient = getAdminClient()

    const { profile, error: lookupError } = await resolveProfile(adminClient, id)
    if (lookupError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Deletion requires trainer-role in the same org, or super_admin. Self-delete via
    // this endpoint is not allowed (clients go through a separate flow).
    const callerIsTrainer = isTrainerRole(ctx.role)
    const sameOrg = !!ctx.organizationId && ctx.organizationId === profile.organization_id
    const allowed = ctx.role === 'super_admin' || (callerIsTrainer && sameOrg)
    if (!allowed) return forbidden()

    // Audit fix (2026-08-26): the comment above claimed self-delete was
    // blocked but nothing enforced it, and there was no client-role guard —
    // so a plain trainer could hard-delete a peer trainer / admin /
    // company_admin in their own org, or themselves. Restrict targets to
    // clients (staff deletion is a super_admin action) and reject self.
    if (ctx.userId === profile.id) {
      return NextResponse.json({ error: 'You cannot delete your own account here.' }, { status: 403 })
    }
    if (ctx.role !== 'super_admin' && profile.role !== 'client') {
      return NextResponse.json(
        { error: 'Only a super admin can delete non-client accounts.' },
        { status: 403 },
      )
    }

    const userId = profile.id

    // Audit fix (2026-08-23): every table below uses `client_id` as its
    // owner column (verified via information_schema). This code used to
    // filter by `user_id`, which silently no-op'd on every DELETE — leaving
    // orphan workout_logs, set_logs (via cascade fail), completions,
    // programs, PRs, progress photos. Real data-loss + App Store 5.1.1(v)
    // "delete all my data" violation. Only invite_tokens uses user_id
    // (references auth.users) so that filter stays.
    const { data: clientPrograms } = await adminClient
      .from('client_programs')
      .select('id')
      .eq('client_id', userId)
    const programIds = clientPrograms?.map(p => p.id) || []
    if (programIds.length > 0) {
      await adminClient.from('client_exercise_sets').delete().in('client_program_id', programIds)
    }

    await adminClient.from('client_programs').delete().eq('client_id', userId)
    await adminClient.from('client_nutrition').delete().eq('client_id', userId)
    await adminClient.from('client_1rms').delete().eq('client_id', userId)
    await adminClient.from('client_1rm_history').delete().eq('client_id', userId)
    await adminClient.from('client_streaks').delete().eq('client_id', userId)
    await adminClient.from('personal_records').delete().eq('client_id', userId)

    const { data: workoutLogs } = await adminClient
      .from('workout_logs')
      .select('id')
      .eq('client_id', userId)
    const workoutLogIds = workoutLogs?.map(wl => wl.id) || []
    if (workoutLogIds.length > 0) {
      await adminClient.from('set_logs').delete().in('workout_log_id', workoutLogIds)
    }

    await adminClient.from('workout_logs').delete().eq('client_id', userId)
    await adminClient.from('workout_completions').delete().eq('client_id', userId)
    await adminClient.from('progress_images').delete().eq('client_id', userId)
    await adminClient.from('invite_tokens').delete().eq('user_id', userId)

    const { error: profileDeleteError } = await adminClient
      .from('profiles')
      .delete()
      .eq('id', userId)
    if (profileDeleteError) {
      return NextResponse.json({
        error: 'Failed to delete user profile',
        details: profileDeleteError.message,
      }, { status: 500 })
    }

    const { error: authError } = await adminClient.auth.admin.deleteUser(userId)
    if (authError) {
      return NextResponse.json({
        error: 'Profile deleted but auth user could not be removed',
        details: authError.message,
      }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete user error:', error)
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}
