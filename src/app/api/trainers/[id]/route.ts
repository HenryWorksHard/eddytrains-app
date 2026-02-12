import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/app/lib/supabase/server'

// DELETE /api/trainers/[id] - Remove a trainer and their organization
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: organizationId } = await params
  
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // Verify user is super_admin
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden - super_admin only' }, { status: 403 })
    }

    // Get organization details first
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, name, owner_id')
      .eq('id', organizationId)
      .single()

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Don't allow deleting the super_admin's organization
    const { data: ownerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', org.owner_id)
      .single()

    if (ownerProfile?.role === 'super_admin') {
      return NextResponse.json({ error: 'Cannot delete super_admin organization' }, { status: 400 })
    }

    // Get all profiles in this organization
    const { data: orgProfiles } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('organization_id', organizationId)

    const profileIds = orgProfiles?.map(p => p.id) || []

    // Delete in order (respecting foreign keys):

    // 1. Delete client-related data
    if (profileIds.length > 0) {
      // Delete workout completions
      await supabaseAdmin
        .from('workout_completions')
        .delete()
        .in('client_id', profileIds)

      // Delete workout logs and their set logs
      const { data: workoutLogs } = await supabaseAdmin
        .from('workout_logs')
        .select('id')
        .in('client_id', profileIds)

      if (workoutLogs && workoutLogs.length > 0) {
        const logIds = workoutLogs.map(l => l.id)
        
        await supabaseAdmin
          .from('set_logs')
          .delete()
          .in('workout_log_id', logIds)

        await supabaseAdmin
          .from('exercise_substitutions')
          .delete()
          .in('workout_log_id', logIds)

        await supabaseAdmin
          .from('workout_logs')
          .delete()
          .in('id', logIds)
      }

      // Delete client programs and their exercise sets
      const { data: clientPrograms } = await supabaseAdmin
        .from('client_programs')
        .select('id')
        .in('client_id', profileIds)

      if (clientPrograms && clientPrograms.length > 0) {
        const cpIds = clientPrograms.map(cp => cp.id)
        
        await supabaseAdmin
          .from('client_exercise_sets')
          .delete()
          .in('client_program_id', cpIds)

        await supabaseAdmin
          .from('client_programs')
          .delete()
          .in('id', cpIds)
      }

      // Delete client nutrition
      await supabaseAdmin
        .from('client_nutrition')
        .delete()
        .in('client_id', profileIds)

      // Delete client 1RMs
      await supabaseAdmin
        .from('client_1rms')
        .delete()
        .in('client_id', profileIds)

      await supabaseAdmin
        .from('client_1rm_history')
        .delete()
        .in('client_id', profileIds)

      // Delete personal records
      await supabaseAdmin
        .from('personal_records')
        .delete()
        .in('client_id', profileIds)

      // Delete progress images
      await supabaseAdmin
        .from('progress_images')
        .delete()
        .in('client_id', profileIds)

      // Delete client streaks
      await supabaseAdmin
        .from('client_streaks')
        .delete()
        .in('client_id', profileIds)

      // Delete client custom exercises
      await supabaseAdmin
        .from('client_custom_exercises')
        .delete()
        .in('client_id', profileIds)

      // Delete admin notifications
      await supabaseAdmin
        .from('admin_notifications')
        .delete()
        .in('client_id', profileIds)
    }

    // 2. Delete organization's programs
    const { data: programs } = await supabaseAdmin
      .from('programs')
      .select('id')
      .eq('organization_id', organizationId)

    if (programs && programs.length > 0) {
      const programIds = programs.map(p => p.id)

      // Get all workouts
      const { data: workouts } = await supabaseAdmin
        .from('program_workouts')
        .select('id')
        .in('program_id', programIds)

      if (workouts && workouts.length > 0) {
        const workoutIds = workouts.map(w => w.id)

        // Get all exercises
        const { data: exercises } = await supabaseAdmin
          .from('workout_exercises')
          .select('id')
          .in('workout_id', workoutIds)

        if (exercises && exercises.length > 0) {
          const exerciseIds = exercises.map(e => e.id)

          // Delete exercise sets
          await supabaseAdmin
            .from('exercise_sets')
            .delete()
            .in('exercise_id', exerciseIds)

          // Delete workout exercises
          await supabaseAdmin
            .from('workout_exercises')
            .delete()
            .in('id', exerciseIds)
        }

        // Delete program workouts
        await supabaseAdmin
          .from('program_workouts')
          .delete()
          .in('id', workoutIds)
      }

      // Delete programs
      await supabaseAdmin
        .from('programs')
        .delete()
        .in('id', programIds)
    }

    // 3. Delete nutrition plans
    await supabaseAdmin
      .from('nutrition_plans')
      .delete()
      .eq('organization_id', organizationId)

    // 4. Delete auth users for all profiles in org
    for (const profileId of profileIds) {
      await supabaseAdmin.auth.admin.deleteUser(profileId)
    }

    // 5. Delete profiles
    await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('organization_id', organizationId)

    // 6. Finally, delete the organization
    const { error: deleteOrgError } = await supabaseAdmin
      .from('organizations')
      .delete()
      .eq('id', organizationId)

    if (deleteOrgError) {
      throw deleteOrgError
    }

    return NextResponse.json({ 
      success: true, 
      message: `Organization "${org.name}" and all associated data deleted` 
    })

  } catch (error) {
    console.error('Error deleting trainer/organization:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete trainer' },
      { status: 500 }
    )
  }
}
