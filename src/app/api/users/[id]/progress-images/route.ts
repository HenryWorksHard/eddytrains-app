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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params
    const adminClient = getAdminClient()
    
    const { data, error } = await adminClient
      .from('progress_images')
      .select('*')
      .eq('client_id', userId)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching progress images:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('Progress images fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch progress images' }, { status: 500 })
  }
}
