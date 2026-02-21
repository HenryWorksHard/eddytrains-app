import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    
    // Supabase has a default 1000 row limit per request
    // We need to paginate to get all exercises
    const PAGE_SIZE = 1000
    let allExercises: any[] = []
    let page = 0
    let hasMore = true
    
    while (hasMore) {
      const from = page * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      
      const { data: exercises, error } = await supabase
        .from('exercises')
        .select('*')
        .order('name', { ascending: true })
        .range(from, to)
      
      if (error) {
        console.error('Error fetching exercises:', error)
        return NextResponse.json({ 
          error: 'Failed to fetch exercises',
          details: error.message 
        }, { status: 500 })
      }
      
      if (exercises && exercises.length > 0) {
        allExercises = [...allExercises, ...exercises]
        hasMore = exercises.length === PAGE_SIZE
        page++
      } else {
        hasMore = false
      }
    }
    
    console.log(`Fetched ${allExercises.length} exercises from database (${page} pages)`)
    
    // Transform to match expected format
    const formattedExercises = allExercises.map(ex => ({
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
    }))
    
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
