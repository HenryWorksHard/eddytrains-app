import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/app/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { sendInviteEmail } from '@/app/lib/email'

// Admin client with service role for user management
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

// Get current user's profile info
async function getCurrentUserProfile() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, organization_id, company_id')
    .eq('id', user.id)
    .single()
  
  return profile
}

// Generate a random password for the auth user. The client never sees it —
// they'll set their own via the invite link.
function generateRandomPassword(): string {
  return randomBytes(32).toString('base64url')
}

export async function GET() {
  try {
    const adminClient = getAdminClient()
    
    // Get current user from auth session
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ users: [], debug: { reason: 'not_authenticated' } })
    }
    
    // Get user profile using admin client (bypasses RLS)
    const { data: currentUser, error: profileError } = await adminClient
      .from('profiles')
      .select('id, role, organization_id, company_id')
      .eq('id', user.id)
      .single()
    
    console.log('[API /users] Current user:', { id: user.id, email: user.email, profile: currentUser, error: profileError?.message })
    
    const organizationId = currentUser?.organization_id
    
    if (!organizationId) {
      return NextResponse.json({ 
        users: [], 
        debug: { 
          reason: 'no_org_id',
          userId: user.id,
          userEmail: user.email,
          profileError: profileError?.message
        } 
      })
    }
    
    // Get organization's visibility settings
    const { data: org } = await adminClient
      .from('organizations')
      .select('trainer_visibility, organization_type')
      .eq('id', organizationId)
      .single()
    
    console.log('[API /users] Org settings:', { visibility: org?.trainer_visibility, type: org?.organization_type })
    
    // Build the query
    let query = adminClient
      .from('profiles')
      .select('*')
      .eq('role', 'client')
    
    // Apply visibility filter:
    // - If user is a trainer AND org visibility is 'assigned', show only their clients
    // - Otherwise show all clients in the organization
    if (
      currentUser.role === 'trainer' && 
      org?.trainer_visibility === 'assigned'
    ) {
      // Trainer can only see clients assigned to them
      console.log('[API /users] Filtering by trainer_id:', currentUser.id)
      query = query.eq('trainer_id', currentUser.id)
    } else {
      // Team visibility OR user is admin/company_admin - show all org clients
      console.log('[API /users] Filtering by organization_id:', organizationId)
      query = query.eq('organization_id', organizationId)
    }
    
    const { data: profiles, error } = await query.order('created_at', { ascending: false })
    
    console.log('[API /users] Query result:', { count: profiles?.length, error: error?.message })
    
    if (error) throw error

    // Get auth users for email addresses
    const { data: authUsers } = await adminClient.auth.admin.listUsers()
    
    const usersWithEmail = profiles?.map(p => {
      const authUser = authUsers?.users?.find(u => u.id === p.id)
      return {
        ...p,
        email: authUser?.email || 'Unknown',
        last_sign_in: authUser?.last_sign_in_at
      }
    }) || []
    
    return NextResponse.json({ 
      users: usersWithEmail,
      debug: {
        userId: user.id,
        userEmail: user.email,
        organizationId,
        userRole: currentUser?.role,
        visibility: org?.trainer_visibility,
        clientCount: profiles?.length || 0
      }
    })
  } catch (error) {
    console.error('Get users error:', error)
    return NextResponse.json({ error: 'Failed to fetch users', debug: { error: String(error) } }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('id')
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }
    
    const adminClient = getAdminClient()
    
    // Verify this is a client (not admin/trainer)
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('role, full_name, email')
      .eq('id', userId)
      .single()
    
    console.log('[DELETE user] Profile lookup:', { userId, profile, error: profileError?.message })
    
    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    if (profile.role !== 'client') {
      return NextResponse.json({ error: 'Can only delete client accounts' }, { status: 403 })
    }
    
    // Delete related data first (foreign key constraints)
    // Order matters - delete child records before parent
    console.log('[DELETE user] Cleaning up related data for:', userId)
    
    // Get client_program IDs first for cascade deletes
    const { data: clientPrograms } = await adminClient
      .from('client_programs')
      .select('id')
      .eq('user_id', userId)
    
    const programIds = clientPrograms?.map(p => p.id) || []
    
    if (programIds.length > 0) {
      // Delete client_exercise_sets linked to client_programs
      await adminClient.from('client_exercise_sets').delete().in('client_program_id', programIds)
    }
    
    // Delete other related records
    await adminClient.from('client_programs').delete().eq('user_id', userId)
    await adminClient.from('client_nutrition').delete().eq('client_id', userId)
    await adminClient.from('client_1rms').delete().eq('user_id', userId)
    await adminClient.from('client_1rm_history').delete().eq('user_id', userId)
    await adminClient.from('client_streaks').delete().eq('user_id', userId)
    await adminClient.from('personal_records').delete().eq('user_id', userId)
    // Get workout_log IDs first for set_logs deletion (set_logs doesn't have user_id column)
    const { data: workoutLogs } = await adminClient
      .from('workout_logs')
      .select('id')
      .eq('user_id', userId)
    
    const workoutLogIds = workoutLogs?.map(wl => wl.id) || []
    
    // Delete set_logs by workout_log_id (not user_id - that column doesn't exist)
    if (workoutLogIds.length > 0) {
      await adminClient.from('set_logs').delete().in('workout_log_id', workoutLogIds)
    }
    
    await adminClient.from('workout_logs').delete().eq('user_id', userId)
    await adminClient.from('workout_completions').delete().eq('user_id', userId)
    await adminClient.from('progress_images').delete().eq('user_id', userId)

    // Explicitly clear invite_tokens so nothing is left pointing at the auth user
    await adminClient.from('invite_tokens').delete().eq('user_id', userId)

    // Delete profile FIRST. profiles.id references auth.users(id), so the auth
    // delete below would fail with an FK violation if the profile still exists.
    const { error: profileDeleteError } = await adminClient
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (profileDeleteError) {
      console.error('[DELETE user] Profile delete error:', profileDeleteError)
      return NextResponse.json({
        error: 'Failed to delete user profile',
        details: profileDeleteError.message
      }, { status: 500 })
    }

    // Now delete the auth user — this revokes their ability to sign in.
    const { error: authError } = await adminClient.auth.admin.deleteUser(userId)
    if (authError) {
      console.error('[DELETE user] Auth delete error:', authError)
      return NextResponse.json({
        error: 'Profile deleted but auth user could not be removed',
        details: authError.message,
      }, { status: 500 })
    }

    console.log('[DELETE user] Successfully deleted user:', { userId })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE user] Error:', error)
    return NextResponse.json({ 
      error: 'Failed to delete user', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

// Generate unique slug from name or email
async function generateSlug(adminClient: ReturnType<typeof getAdminClient>, name: string | null, email: string): Promise<string> {
  let base = name || email.split('@')[0]
  base = base.toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 20)
  
  if (!base) base = 'user'
  
  // Check existing slugs
  const { data } = await adminClient
    .from('profiles')
    .select('slug')
    .not('slug', 'is', null)
  
  const existingSlugs = new Set((data || []).map(p => p.slug))
  
  let slug = base
  let counter = 1
  while (existingSlugs.has(slug)) {
    slug = `${base}${counter}`
    counter++
  }
  return slug
}

export async function POST(request: NextRequest) {
  try {
    const { email, full_name, permissions, organization_id, trainer_id } = await request.json()
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }
    
    const adminClient = getAdminClient()
    
    // Check client limit if organization_id provided
    if (organization_id) {
      // Get organization's client limit
      const { data: org } = await adminClient
        .from('organizations')
        .select('client_limit, subscription_status')
        .eq('id', organization_id)
        .single()
      
      if (org) {
        // Check subscription status
        if (org.subscription_status === 'canceled' || org.subscription_status === 'past_due') {
          return NextResponse.json({ 
            error: 'Subscription inactive', 
            details: 'Please update your billing to add new clients.',
            upgradeRequired: true
          }, { status: 403 })
        }
        
        // Check client count (only if not unlimited)
        if (org.client_limit !== -1) {
          const { count } = await adminClient
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', organization_id)
            .eq('role', 'client')
          
          if (count !== null && count >= org.client_limit) {
            return NextResponse.json({ 
              error: 'Client limit reached', 
              details: `You've reached your limit of ${org.client_limit} clients. Upgrade your plan to add more.`,
              currentCount: count,
              limit: org.client_limit,
              upgradeRequired: true
            }, { status: 403 })
          }
        }
      }
    }
    
    // Check if email already exists in auth — surface a clean error instead of DB violation
    const { data: existingList } = await adminClient.auth.admin.listUsers()
    const emailLower = email.toLowerCase()
    const existing = existingList?.users?.find(u => u.email?.toLowerCase() === emailLower)
    if (existing) {
      return NextResponse.json({
        error: 'A user with this email already exists',
        details: 'If this is a client you previously created, use the "Resend invite" option from the users list.'
      }, { status: 409 })
    }

    // Generate unique slug
    const slug = await generateSlug(adminClient, full_name, email)

    // Get current user to auto-assign trainer_id if applicable
    const currentUser = await getCurrentUserProfile()
    let assignedTrainerId = trainer_id || null
    let assignedCompanyId = null

    if (currentUser?.role === 'trainer' && !trainer_id) {
      assignedTrainerId = currentUser.id
      assignedCompanyId = currentUser.company_id
    } else if (currentUser?.role === 'company_admin') {
      assignedCompanyId = currentUser.company_id || currentUser.organization_id
    }

    // Create auth user with throwaway password — client will set their own via invite link
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: generateRandomPassword(),
      email_confirm: true,
      user_metadata: {
        full_name: full_name || email.split('@')[0]
      }
    })

    if (createError || !newUser?.user) {
      console.error('Create user error:', createError)
      return NextResponse.json({ error: createError?.message || 'Failed to create user' }, { status: 400 })
    }

    // Create profile
    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert({
        id: newUser.user.id,
        email: email,
        slug: slug,
        full_name: full_name || email.split('@')[0],
        role: 'client',
        organization_id: organization_id || null,
        trainer_id: assignedTrainerId,
        company_id: assignedCompanyId,
        is_active: true,
        must_change_password: true,
        password_changed: false,
        status: 'pending',
        can_access_strength: permissions?.strength || false,
        can_access_cardio: permissions?.cardio || false,
        can_access_hyrox: permissions?.hyrox || false,
        can_access_hybrid: permissions?.hybrid || false,
        can_access_nutrition: permissions?.nutrition || false
      })

    if (profileError) {
      console.error('Profile error:', profileError)
      // Roll back auth user so the state stays consistent
      await adminClient.auth.admin.deleteUser(newUser.user.id).catch(() => {})
      return NextResponse.json({
        error: 'Failed to create profile',
        details: profileError.message
      }, { status: 500 })
    }

    // Create invite token and send email
    const { data: tokenRow, error: tokenError } = await adminClient
      .from('invite_tokens')
      .insert({
        user_id: newUser.user.id,
        email,
        created_by: currentUser?.id ?? null,
      })
      .select('token')
      .single()

    if (tokenError || !tokenRow) {
      console.error('Invite token error:', tokenError)
      return NextResponse.json({
        error: 'User created but invite token could not be generated. Use Resend invite from the users list.',
        userId: newUser.user.id,
      }, { status: 500 })
    }

    // Fetch trainer/org names for the email greeting
    let trainerName: string | null = null
    let orgName: string | null = null
    if (currentUser?.id) {
      const { data: trainerProfile } = await adminClient
        .from('profiles')
        .select('full_name')
        .eq('id', currentUser.id)
        .single()
      trainerName = trainerProfile?.full_name ?? null
    }
    if (organization_id) {
      const { data: org } = await adminClient
        .from('organizations')
        .select('name')
        .eq('id', organization_id)
        .single()
      orgName = org?.name ?? null
    }

    let inviteSent = false
    let inviteError: string | null = null
    try {
      await sendInviteEmail({
        email,
        fullName: full_name || null,
        token: tokenRow.token,
        trainerName,
        orgName,
      })
      inviteSent = true
    } catch (e) {
      console.error('Send invite email error:', e)
      inviteError = e instanceof Error ? e.message : 'Email failed to send'
    }

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.user.id,
        email: newUser.user.email,
        slug,
      },
      inviteSent,
      inviteError,
      // Fallback: trainer can copy this link if email failed for any reason
      inviteLink: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.cmpdcollective.com'}/accept-invite?token=${tokenRow.token}`,
    })

  } catch (error) {
    console.error('Create user error:', error)
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}
