import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, unauthorized, forbidden } from '@/app/lib/auth-guard'

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
    const ctx = await getAuthContext()
    if (!ctx) return unauthorized()
    if (ctx.role !== 'super_admin') return forbidden()

    const { searchParams } = new URL(request.url)
    const trainerFilter = searchParams.get('trainerFilter')

    const adminClient = getAdminClient()

    // Build query
    let query = adminClient
      .from('profiles')
      .select('id, full_name, email, is_active, created_at, status, trainer_id')
      .eq('role', 'client')
      .order('created_at', { ascending: false })

    // Filter by trainer if specified
    if (trainerFilter) {
      query = query.eq('trainer_id', trainerFilter)
    }

    const { data: profiles, error } = await query

    if (error) throw error

    // Email straight from profiles; auth.admin.listUsers() only returns the
    // first 50 accounts and cost an admin API call per load.
    const usersWithEmail = profiles?.map(p => ({
      ...p,
      email: p.email || 'Unknown',
    })) || []

    return NextResponse.json({ users: usersWithEmail })
  } catch (error) {
    console.error('Admin users error:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}
