import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/app/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveOrgId } from '@/app/lib/org-context'

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
    const { id } = await params
    const adminClient = getAdminClient()
    
    // Resolve by slug, email, or UUID
    const { profile, error: profileError, lookupField } = await resolveProfile(adminClient, id)
    
    if (profileError || !profile) {
      console.error('Profile query error:', profileError)
      return NextResponse.json({ 
        error: 'User not found',
        details: profileError?.message,
        lookupField,
        lookupValue: decodeURIComponent(id)
      }, { status: 404 })
    }

    // Get auth user for email verification
    const { data: authUser } = await adminClient.auth.admin.getUserById(profile.id)
    
    // Return profile with permissions embedded (no JOIN needed)
    return NextResponse.json({ 
      user: {
        ...profile,
        email: authUser?.user?.email || profile.email || 'Unknown',
        // Map embedded permissions to the expected format for frontend compatibility
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
    const { id } = await params
    const { full_name, email, permissions } = await request.json()
    const adminClient = getAdminClient()
    
    const { profile, error: lookupError } = await resolveProfile(adminClient, id)
    if (lookupError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    const userId = profile.id
    
    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }
    
    if (full_name !== undefined) updateData.full_name = full_name
    if (email !== undefined) updateData.email = email
    
    // Permissions are now embedded in profiles table
    // "programs" controls access to all program types (strength/cardio/hyrox/hybrid)
    if (permissions) {
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

    // Update auth user email if changed
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
    const { id } = await params
    const adminClient = getAdminClient()

    const { profile, error: lookupError } = await resolveProfile(adminClient, id)
    if (lookupError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userId = profile.id

    // Enforce org boundary: caller must be in the same effective org as the target,
    // unless caller is a super_admin.
    const supabase = await createServerClient()
    const { data: { user: caller } } = await supabase.auth.getUser()
    if (!caller) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()
    if (!callerProfile) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }
    const callerEffectiveOrgId = await getEffectiveOrgId()
    if (
      callerProfile.role !== 'super_admin' &&
      profile.organization_id !== callerEffectiveOrgId
    ) {
      return NextResponse.json({ error: 'Not authorized to delete this user' }, { status: 403 })
    }

    // Clean up child data first to satisfy FK constraints.
    // client_exercise_sets → client_programs → (child tables)
    const { data: clientPrograms } = await adminClient
      .from('client_programs')
      .select('id')
      .eq('user_id', userId)
    const programIds = clientPrograms?.map(p => p.id) || []
    if (programIds.length > 0) {
      await adminClient.from('client_exercise_sets').delete().in('client_program_id', programIds)
    }

    await adminClient.from('client_programs').delete().eq('user_id', userId)
    await adminClient.from('client_nutrition').delete().eq('client_id', userId)
    await adminClient.from('client_1rms').delete().eq('user_id', userId)
    await adminClient.from('client_1rm_history').delete().eq('user_id', userId)
    await adminClient.from('client_streaks').delete().eq('user_id', userId)
    await adminClient.from('personal_records').delete().eq('user_id', userId)

    const { data: workoutLogs } = await adminClient
      .from('workout_logs')
      .select('id')
      .eq('user_id', userId)
    const workoutLogIds = workoutLogs?.map(wl => wl.id) || []
    if (workoutLogIds.length > 0) {
      await adminClient.from('set_logs').delete().in('workout_log_id', workoutLogIds)
    }

    await adminClient.from('workout_logs').delete().eq('user_id', userId)
    await adminClient.from('workout_completions').delete().eq('user_id', userId)
    await adminClient.from('progress_images').delete().eq('user_id', userId)
    await adminClient.from('invite_tokens').delete().eq('user_id', userId)

    // Profile before auth — FK from profiles.id → auth.users(id)
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
