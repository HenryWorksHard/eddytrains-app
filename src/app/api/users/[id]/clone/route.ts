import { createClient } from '@/app/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: targetUserId } = await context.params
    const { sourceUserId, includePrograms, includeNutrition } = await request.json()

    const supabase = await createClient()

    // Verify both users exist
    const { data: targetUser, error: targetError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', targetUserId)
      .single()

    if (targetError || !targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
    }

    const { data: sourceUser, error: sourceError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', sourceUserId)
      .single()

    if (sourceError || !sourceUser) {
      return NextResponse.json({ error: 'Source user not found' }, { status: 404 })
    }

    const results = {
      programsCloned: 0,
      nutritionCloned: false
    }

    // Clone programs
    if (includePrograms) {
      // Get source user's active programs
      const { data: sourcePrograms, error: programsError } = await supabase
        .from('client_programs')
        .select(`
          id,
          program_id,
          duration_weeks,
          phase_name,
          is_active
        `)
        .eq('client_id', sourceUserId)
        .eq('is_active', true)

      if (!programsError && sourcePrograms) {
        for (const program of sourcePrograms) {
          // Create new client_program for target user
          const startDate = new Date()
          const endDate = new Date()
          endDate.setDate(endDate.getDate() + (program.duration_weeks * 7))

          const { data: newClientProgram, error: insertError } = await supabase
            .from('client_programs')
            .insert({
              client_id: targetUserId,
              program_id: program.program_id,
              start_date: startDate.toISOString().split('T')[0],
              end_date: endDate.toISOString().split('T')[0],
              duration_weeks: program.duration_weeks,
              phase_name: program.phase_name,
              is_active: true
            })
            .select()
            .single()

          if (!insertError && newClientProgram) {
            results.programsCloned++

            // Clone custom exercise sets if any
            const { data: customSets } = await supabase
              .from('client_exercise_sets')
              .select('*')
              .eq('client_program_id', program.id)

            if (customSets && customSets.length > 0) {
              const setsToInsert = customSets.map(set => ({
                ...set,
                id: undefined,
                client_program_id: newClientProgram.id,
                created_at: undefined,
                updated_at: undefined
              }))

              await supabase
                .from('client_exercise_sets')
                .insert(setsToInsert)
            }
          }
        }
      }
    }

    // Clone nutrition
    if (includeNutrition) {
      // Get source user's nutrition assignment
      const { data: sourceNutrition, error: nutritionError } = await supabase
        .from('client_nutrition')
        .select('plan_id, notes')
        .eq('client_id', sourceUserId)
        .single()

      if (!nutritionError && sourceNutrition) {
        // Delete existing nutrition for target user
        await supabase
          .from('client_nutrition')
          .delete()
          .eq('client_id', targetUserId)

        // Assign same nutrition plan
        const { error: insertError } = await supabase
          .from('client_nutrition')
          .insert({
            client_id: targetUserId,
            plan_id: sourceNutrition.plan_id,
            notes: sourceNutrition.notes
          })

        if (!insertError) {
          results.nutritionCloned = true
        }
      }
    }

    return NextResponse.json({
      success: true,
      results
    })
  } catch (error) {
    console.error('Clone error:', error)
    return NextResponse.json(
      { error: 'Failed to clone user setup' },
      { status: 500 }
    )
  }
}
