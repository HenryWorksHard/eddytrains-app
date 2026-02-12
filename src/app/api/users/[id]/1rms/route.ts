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
      .from('client_1rms')
      .select('*')
      .eq('client_id', userId)
    
    if (error) {
      console.error('Error fetching 1RMs:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('1RMs fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch 1RMs' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params
    const { oneRMs } = await request.json()
    const adminClient = getAdminClient()
    
    // Filter to only save non-zero values
    const toSave = (oneRMs || []).filter((rm: { weight_kg: number }) => rm.weight_kg > 0)
    
    for (const rm of toSave) {
      const { error } = await adminClient
        .from('client_1rms')
        .upsert({
          client_id: userId,
          exercise_name: rm.exercise_name,
          weight_kg: rm.weight_kg,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'client_id,exercise_name'
        })
      
      if (error) {
        console.error('Error upserting 1RM:', error)
        throw error
      }
    }
    
    // Delete any that are now zero (if they had an id, meaning they existed before)
    const toDelete = (oneRMs || []).filter((rm: { weight_kg: number; id?: string }) => rm.weight_kg === 0 && rm.id)
    for (const rm of toDelete) {
      await adminClient
        .from('client_1rms')
        .delete()
        .eq('id', rm.id)
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('1RMs save error:', error)
    return NextResponse.json({ error: 'Failed to save 1RMs' }, { status: 500 })
  }
}
