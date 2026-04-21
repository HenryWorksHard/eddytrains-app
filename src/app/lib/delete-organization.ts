import type { SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, 'public', 'public', any, any>

/**
 * Fully deletes an organization and all its data — profiles, auth users,
 * programs, nutrition plans, workout logs, everything.
 *
 * Works for both solo trainer orgs and company orgs (company trainers carry
 * company_id = organization.id = this id).
 *
 * The deletion order matters because several FKs are NO ACTION rather than
 * CASCADE. Documented order below:
 *
 *   1. workout_logs.trainer_id → profiles.id  (NO ACTION) → must delete workout_logs first
 *   2. programs.organization_id → organizations.id  (NO ACTION) → delete programs before org
 *   3. nutrition_plans.organization_id → organizations.id  (NO ACTION) → same
 *   4. profiles.organization_id → organizations.id  (NO ACTION) → delete profiles before org
 *   5. profiles.company_id → organizations.id  (NO ACTION) → same
 *   6. profiles.id → auth.users.id  (no DB FK, but Supabase enforces via admin API) →
 *      delete profile row before auth.admin.deleteUser to avoid FK violation
 *
 * Returns either success, or success with warnings (partial cleanup e.g. one
 * auth user failed to delete).
 */
export async function deleteOrganizationCompletely(
  admin: AdminClient,
  organizationId: string
): Promise<
  | { ok: true; warnings: string[] }
  | { ok: false; error: string; stage: string }
> {
  const warnings: string[] = []

  // 0. Load org (also confirms it exists)
  const { data: org, error: orgError } = await admin
    .from('organizations')
    .select('id, name, owner_id')
    .eq('id', organizationId)
    .single()
  if (orgError || !org) {
    return { ok: false, error: 'Organization not found', stage: 'load_org' }
  }

  // Safety: never allow deleting an org owned by a super_admin
  if (org.owner_id) {
    const { data: owner } = await admin
      .from('profiles')
      .select('role')
      .eq('id', org.owner_id)
      .single()
    if (owner?.role === 'super_admin') {
      return { ok: false, error: 'Cannot delete a super_admin organization', stage: 'safety_check' }
    }
  }

  // 1. Collect all profile IDs attached to this org (via organization_id OR company_id)
  const { data: orgProfiles } = await admin
    .from('profiles')
    .select('id')
    .or(`organization_id.eq.${organizationId},company_id.eq.${organizationId}`)
  const profileIds = (orgProfiles || []).map((p: { id: string }) => p.id)

  // 2. Delete workout_logs + set_logs for those profiles (trainer_id on workout_logs is NO ACTION)
  if (profileIds.length > 0) {
    const { data: trainerWorkoutLogs } = await admin
      .from('workout_logs')
      .select('id')
      .in('trainer_id', profileIds)
    const { data: clientWorkoutLogs } = await admin
      .from('workout_logs')
      .select('id')
      .in('client_id', profileIds)
    const logIds = Array.from(
      new Set([
        ...(trainerWorkoutLogs || []).map((l: { id: string }) => l.id),
        ...(clientWorkoutLogs || []).map((l: { id: string }) => l.id),
      ])
    )
    if (logIds.length > 0) {
      await admin.from('set_logs').delete().in('workout_log_id', logIds)
      await admin.from('exercise_substitutions').delete().in('workout_log_id', logIds)
      await admin.from('workout_logs').delete().in('id', logIds)
    }
  }

  // 3. Delete org's programs (NO ACTION on org) — CASCADEs to workouts/exercises/sets
  //    and to client_programs that reference them.
  const { data: programs } = await admin
    .from('programs')
    .select('id')
    .eq('organization_id', organizationId)
  if (programs && programs.length > 0) {
    const programIds = programs.map((p: { id: string }) => p.id)
    // Clean exercise_sets and workout_exercises that don't cascade
    const { data: workouts } = await admin
      .from('program_workouts')
      .select('id')
      .in('program_id', programIds)
    if (workouts && workouts.length > 0) {
      const workoutIds = workouts.map((w: { id: string }) => w.id)
      const { data: exercises } = await admin
        .from('workout_exercises')
        .select('id')
        .in('workout_id', workoutIds)
      if (exercises && exercises.length > 0) {
        const exerciseIds = exercises.map((e: { id: string }) => e.id)
        await admin.from('exercise_sets').delete().in('exercise_id', exerciseIds)
        await admin.from('workout_exercises').delete().in('id', exerciseIds)
      }
      await admin.from('program_workouts').delete().in('id', workoutIds)
    }
    await admin.from('programs').delete().in('id', programIds)
  }

  // 4. Delete nutrition_plans (NO ACTION on org) — client_nutrition.plan_id is SET NULL
  await admin.from('nutrition_plans').delete().eq('organization_id', organizationId)

  // 5. Delete invite_tokens for these users (CASCADEs from auth.users, but be explicit)
  if (profileIds.length > 0) {
    await admin.from('invite_tokens').delete().in('user_id', profileIds)
  }

  // 6. Delete profiles. CASCADEs will clean: admin_notifications, client_1rm_history,
  //    client_1rms, client_custom_exercises, client_nutrition, client_streaks,
  //    personal_records, workout_completions.
  if (profileIds.length > 0) {
    const { error: profileDeleteError } = await admin
      .from('profiles')
      .delete()
      .in('id', profileIds)
    if (profileDeleteError) {
      return {
        ok: false,
        error: `Failed to delete profiles: ${profileDeleteError.message}`,
        stage: 'delete_profiles',
      }
    }
  }

  // 7. Delete auth users (now safe — profiles.id FK cleared)
  for (const profileId of profileIds) {
    const { error: authError } = await admin.auth.admin.deleteUser(profileId)
    if (authError) {
      warnings.push(`auth.deleteUser(${profileId}) failed: ${authError.message}`)
    }
  }

  // 8. Finally, delete the organization
  const { error: deleteOrgError } = await admin
    .from('organizations')
    .delete()
    .eq('id', organizationId)
  if (deleteOrgError) {
    return {
      ok: false,
      error: `Failed to delete organization: ${deleteOrgError.message}`,
      stage: 'delete_org',
    }
  }

  return { ok: true, warnings }
}
