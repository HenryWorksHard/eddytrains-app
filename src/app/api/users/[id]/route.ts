import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

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

// Move profile to inactive list in Klaviyo
async function moveToInactiveList(email: string) {
  const apiKey = process.env.KLAVIYO_API_KEY
  const activeListId = process.env.KLAVIYO_LIST_ID
  const inactiveListId = process.env.KLAVIYO_INACTIVE_LIST_ID
  
  if (!apiKey) return { success: false, reason: 'No API key' }

  try {
    const searchResponse = await fetch(`https://a.klaviyo.com/api/profiles/?filter=equals(email,"${email}")`, {
      headers: {
        'Authorization': `Klaviyo-API-Key ${apiKey}`,
        'revision': '2024-02-15'
      }
    })
    
    const searchData = await searchResponse.json()
    const profileId = searchData.data?.[0]?.id
    
    if (!profileId) return { success: false, reason: 'Profile not found' }

    if (activeListId) {
      await fetch(`https://a.klaviyo.com/api/lists/${activeListId}/relationships/profiles/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Klaviyo-API-Key ${apiKey}`,
          'Content-Type': 'application/json',
          'revision': '2024-02-15'
        },
        body: JSON.stringify({ data: [{ type: 'profile', id: profileId }] })
      })
    }

    if (inactiveListId) {
      await fetch(`https://a.klaviyo.com/api/lists/${inactiveListId}/relationships/profiles/`, {
        method: 'POST',
        headers: {
          'Authorization': `Klaviyo-API-Key ${apiKey}`,
          'Content-Type': 'application/json',
          'revision': '2024-02-15'
        },
        body: JSON.stringify({ data: [{ type: 'profile', id: profileId }] })
      })
    }

    return { success: true, profileId }
  } catch (error) {
    console.error('Klaviyo error:', error)
    return { success: false, error }
  }
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
  request: NextRequest,
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
    const { data: authUser } = await adminClient.auth.admin.getUserById(userId)
    const userEmail = authUser?.user?.email || profile.email

    // Move to inactive list in Klaviyo
    if (userEmail) {
      await moveToInactiveList(userEmail)
    }

    // Delete from auth (cascades to profile if FK is set)
    const { error: authError } = await adminClient.auth.admin.deleteUser(userId)
    if (authError) throw authError

    // Also delete profile manually in case no cascade
    await adminClient.from('profiles').delete().eq('id', userId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete user error:', error)
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}
