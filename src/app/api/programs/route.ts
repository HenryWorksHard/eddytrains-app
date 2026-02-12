import { createClient } from '../../lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date().toISOString().split('T')[0]

  // Get active programs
  const { data: activePrograms } = await supabase
    .from('client_programs')
    .select(`*, program:programs (*)`)
    .eq('client_id', user.id)
    .eq('is_active', true)
    .lte('start_date', today)
    .or(`end_date.gte.${today},end_date.is.null`)
    .order('start_date', { ascending: false })

  const clientPrograms = activePrograms || []
  const allProgramIds = clientPrograms.map(cp => cp.program_id).filter(Boolean)
  
  let programWorkoutsMap: Record<string, any[]> = {}
  
  if (allProgramIds.length > 0) {
    const { data: workoutsData } = await supabase
      .from('program_workouts')
      .select('id, name, day_of_week, order_index, program_id, parent_workout_id')
      .in('program_id', allProgramIds)
      .order('order_index')
    
    const allWorkouts = workoutsData || []
    const finishersByParent: Record<string, typeof allWorkouts> = {}
    
    allWorkouts.forEach(w => {
      if (w.parent_workout_id) {
        if (!finishersByParent[w.parent_workout_id]) {
          finishersByParent[w.parent_workout_id] = []
        }
        finishersByParent[w.parent_workout_id].push(w)
      }
    })
    
    allWorkouts.forEach(w => {
      if (w.parent_workout_id) return
      
      if (!programWorkoutsMap[w.program_id]) {
        programWorkoutsMap[w.program_id] = []
      }
      
      const finishers = finishersByParent[w.id] || []
      programWorkoutsMap[w.program_id].push({
        ...w,
        finisher: finishers[0] || null
      })
    })
  }

  return NextResponse.json({
    clientPrograms: clientPrograms.map(cp => ({
      ...cp,
      program: Array.isArray(cp.program) ? cp.program[0] : cp.program
    })),
    programWorkoutsMap
  })
}
