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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const trainerFilter = searchParams.get('trainerFilter')
    
    const adminClient = getAdminClient()
    
    // Build query
    let query = adminClient
      .from('profiles')
      .select('id, full_name, is_active, created_at, status, trainer_id')
      .eq('role', 'client')
      .order('created_at', { ascending: false })
    
    // Filter by trainer if specified
    if (trainerFilter) {
      query = query.eq('trainer_id', trainerFilter)
    }
    
    const { data: profiles, error } = await query
    
    if (error) throw error

    // Get auth users for email addresses
    const { data: authUsers } = await adminClient.auth.admin.listUsers()
    
    const usersWithEmail = profiles?.map(p => {
      const authUser = authUsers?.users?.find(u => u.id === p.id)
      return {
        ...p,
        email: authUser?.email || 'Unknown'
      }
    }) || []
    
    return NextResponse.json({ users: usersWithEmail })
  } catch (error) {
    console.error('Admin users error:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}
