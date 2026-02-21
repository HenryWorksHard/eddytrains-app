import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    
    // Fetch all exercises from the exercises table
    // No limit - get them all
    const { data: exercises, error, count } = await supabase
      .from('exercises')
      .select('*', { count: 'exact' })
      .order('name', { ascending: true })
    
    if (error) {
      console.error('Error fetching exercises:', error)
      return NextResponse.json({ 
        error: 'Failed to fetch exercises',
        details: error.message 
      }, { status: 500 })
    }
    
    console.log(`Fetched ${exercises?.length || 0} exercises from database (total: ${count})`)
    
    // Transform to match expected format
    const formattedExercises = exercises?.map(ex => ({
      id: ex.id || ex.uuid || ex.name.toLowerCase().replace(/\s+/g, '_'),
      name: ex.name,
      category: ex.category || 'general',
      equipment: ex.equipment || [],
      movementPattern: ex.movement_pattern || ex.movementPattern || 'compound',
      primaryMuscles: ex.primary_muscles || ex.primaryMuscles || [],
      secondaryMuscles: ex.secondary_muscles || ex.secondaryMuscles || [],
      difficulty: ex.difficulty || 'intermediate',
      tags: ex.tags || [],
      instructions: ex.instructions || '',
    })) || []
    
    return NextResponse.json({ 
      exercises: formattedExercises,
      count: formattedExercises.length 
    })
    
  } catch (error) {
    console.error('Error in exercises API:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      exercises: [] 
    }, { status: 500 })
  }
}
