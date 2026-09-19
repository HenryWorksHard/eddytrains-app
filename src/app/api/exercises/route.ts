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
        // Only the columns the picker uses. select('*') dragged tutorial steps,
        // GIF and tutorial URLs for ~1,460 exercises on every request.
        .select('id, name, category, equipment, movement_pattern, primary_muscles, secondary_muscles, difficulty, tags, exercise_type')
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
      exerciseType: ex.exercise_type || 'strength', // strength, cardio, steps, timed
    }))
    
    // The library is identical for everyone and only changes through
    // migrations (nothing in the app writes to it), so let Vercel's edge serve
    // it. Fresh for an hour, and a stale copy is served instantly for up to a
    // day while it refreshes in the background.
    return NextResponse.json(
      { exercises: formattedExercises, count: formattedExercises.length },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
    )
    
  } catch (error) {
    console.error('Error in exercises API:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      exercises: [] 
    }, { status: 500 })
  }
}
