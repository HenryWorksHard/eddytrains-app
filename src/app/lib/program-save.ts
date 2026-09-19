import { randomUUID } from 'crypto'

/**
 * Saves a program's workouts, exercises, sets and finishers.
 *
 * Behaviour is identical to the loop it replaced in api/programs/update; only
 * the shape of the I/O changed. The old version did everything one step at a
 * time — each workout, each exercise within it, and four database calls per
 * exercise — about 28 sequential round trips per workout. An 8-week, 4-day
 * program (32 workouts) was ~900 in a row: with functions in Washington and
 * the database in Sydney, roughly three minutes, which is why the admin
 * portal returned 504s.
 *
 * Now: one upfront read for everything the save needs, two sequential steps
 * per workout, and several workouts processed at once. New rows get their ids
 * generated up front so bulk inserts never have to match returned rows back
 * to their input by position.
 *
 * Rules carried over unchanged:
 * - An existing exercise keeps its row (and every set_log hanging off it),
 *   matched by library exercise id and paired in order so a repeated exercise
 *   still matches. Rows with no exercise_id are left untouched.
 * - A removed workout is only deleted if no client has logged it.
 * - A workout with exactly one existing finisher updates it; with none (or,
 *   as before, more than one) a new finisher is created; with no incoming
 *   finisher, existing ones are removed.
 * - An exercise name matching zero or several library rows gets a null
 *   exercise_uuid, as the old per-name .single() lookup did.
 */

type Admin = any // service-role supabase client
type IncomingSet = any
type IncomingExercise = any
type IncomingFinisher = any
type IncomingWorkout = any

type ExistingExerciseRow = { id: string; workout_id: string; exercise_id: string | null; order_index: number }

// Workouts processed at once. Each can have ~8 requests in flight, so this
// keeps the burst polite to PostgREST's connection pool.
const WORKOUT_CONCURRENCY = 4

function setRow(exerciseRowId: string, set: IncomingSet) {
  return {
    exercise_id: exerciseRowId,
    set_number: set.setNumber,
    reps: set.reps,
    intensity_type: set.intensityType,
    intensity_value: set.intensityValue,
    rest_seconds: set.restSeconds,
    rest_bracket: set.restBracket || '90-120',
    weight_type: set.weightType || 'freeweight',
    notes: set.notes || null,
    cardio_type: set.cardioType || null,
    cardio_value: set.cardioValue || null,
    cardio_unit: set.cardioUnit || null,
    heart_rate_zone: set.heartRateZone || null,
    work_time: set.workTime || null,
    rest_time: set.restTime || null,
    hyrox_station: set.hyroxStation || null,
    hyrox_distance: set.hyroxDistance || null,
    hyrox_unit: set.hyroxUnit || null,
    hyrox_target_time: set.hyroxTargetTime || null,
    hyrox_weight_class: set.hyroxWeightClass || null,
  }
}

function exercisePayload(workoutId: string, exercise: IncomingExercise, refs: Map<string, string | null>) {
  return {
    workout_id: workoutId,
    exercise_id: exercise.exerciseId,
    exercise_name: exercise.exerciseName,
    exercise_uuid: refs.get(exercise.exerciseName) ?? null,
    category: exercise.category || 'strength',
    order_index: exercise.order,
    notes: exercise.notes || null,
    superset_group: exercise.supersetGroup || null,
  }
}

function parentWorkoutFields(workout: IncomingWorkout) {
  return {
    name: workout.name,
    day_of_week: workout.dayOfWeek,
    order_index: workout.order,
    notes: workout.notes || null,
    is_emom: workout.isEmom || false,
    emom_interval: workout.emomInterval || null,
    warmup_exercises: workout.warmupExercises || [],
    recovery_notes: workout.recoveryNotes || null,
    week_number: workout.weekNumber || 1,
  }
}

function finisherFields(finisher: IncomingFinisher) {
  return {
    name: finisher.name,
    category: finisher.category,
    notes: finisher.notes || null,
    is_emom: finisher.isEmom || false,
    emom_interval: finisher.emomInterval || null,
    is_superset: finisher.isSuperset || false,
  }
}

function check(result: { error: unknown }, label: string) {
  if (result.error) {
    console.error(`${label} error:`, result.error)
    throw result.error
  }
}

/** Run with bounded concurrency; stop starting new work after the first failure. */
async function runLimited<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0
  let failure: unknown = null
  let failed = false
  const worker = async () => {
    while (!failed && next < items.length) {
      const item = items[next++]
      try {
        await fn(item)
      } catch (e) {
        if (!failed) { failed = true; failure = e }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  if (failed) throw failure
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/** Library exercise ids by exact name. Ambiguous or missing names -> null. */
async function loadExerciseRefs(admin: Admin, workouts: IncomingWorkout[]) {
  const names = new Set<string>()
  for (const w of workouts) {
    for (const e of w.exercises || []) if (e.exerciseName) names.add(e.exerciseName)
    for (const e of w.finisher?.exercises || []) if (e.exerciseName) names.add(e.exerciseName)
  }
  const refs = new Map<string, string | null>()
  for (const group of chunk(Array.from(names), 100)) {
    const { data } = await admin.from('exercises').select('id, name').in('name', group)
    for (const row of data || []) {
      refs.set(row.name, refs.has(row.name) ? null : row.id)
    }
  }
  return refs
}

/**
 * Reconcile one workout's exercises in place (two sequential steps).
 * existingRows must be this workout's rows, ordered by order_index.
 */
async function syncExercises(
  admin: Admin,
  workoutId: string,
  exercises: IncomingExercise[],
  existingRows: ExistingExerciseRow[],
  refs: Map<string, string | null>,
) {
  const incoming = exercises || []

  const reusable = new Map<string, string[]>()
  for (const row of existingRows) {
    if (!row.exercise_id) continue
    const key = String(row.exercise_id)
    if (!reusable.has(key)) reusable.set(key, [])
    reusable.get(key)!.push(row.id)
  }

  const updates: { id: string; payload: ReturnType<typeof exercisePayload> }[] = []
  const inserts: (ReturnType<typeof exercisePayload> & { id: string })[] = []
  const matchedIds: string[] = []
  const sets: ReturnType<typeof setRow>[] = []

  for (const exercise of incoming) {
    const payload = exercisePayload(workoutId, exercise, refs)
    const key = exercise.exerciseId ? String(exercise.exerciseId) : null
    let rowId: string | undefined = key ? reusable.get(key)?.shift() : undefined
    if (rowId) {
      updates.push({ id: rowId, payload })
      matchedIds.push(rowId)
    } else {
      rowId = randomUUID()
      inserts.push({ id: rowId, ...payload })
    }
    for (const set of exercise.sets || []) sets.push(setRow(rowId, set))
  }

  // Anything left unmatched is an exercise the trainer actually removed.
  const staleIds = Array.from(reusable.values()).flat()

  // Step 1 — independent writes. The prescription sets of reused rows are
  // cleared here (they cascade and carry no client data; set_logs hang off
  // workout_exercises, not exercise_sets), BEFORE the new sets go in below.
  await Promise.all([
    ...updates.map(async (u) =>
      check(await admin.from('workout_exercises').update(u.payload).eq('id', u.id), 'Exercise update')),
    matchedIds.length > 0
      ? admin.from('exercise_sets').delete().in('exercise_id', matchedIds)
      : Promise.resolve(),
    inserts.length > 0
      ? (async () => check(await admin.from('workout_exercises').insert(inserts), 'Exercise insert'))()
      : Promise.resolve(),
    staleIds.length > 0
      ? admin.from('workout_exercises').delete().in('id', staleIds)
      : Promise.resolve(),
  ])

  // Step 2 — every set for this workout in one insert.
  if (sets.length > 0) {
    check(await admin.from('exercise_sets').insert(sets), 'Sets insert')
  }
}

/** Create exercises (and their sets) for a brand-new workout or finisher. */
async function createExercises(admin: Admin, workoutId: string, exercises: IncomingExercise[], refs: Map<string, string | null>) {
  if (!exercises || exercises.length === 0) return
  const rows: (ReturnType<typeof exercisePayload> & { id: string })[] = []
  const sets: ReturnType<typeof setRow>[] = []
  for (const exercise of exercises) {
    const id = randomUUID()
    rows.push({ id, ...exercisePayload(workoutId, exercise, refs) })
    for (const set of exercise.sets || []) sets.push(setRow(id, set))
  }
  check(await admin.from('workout_exercises').insert(rows), 'Exercise insert')
  if (sets.length > 0) check(await admin.from('exercise_sets').insert(sets), 'Sets insert')
}

async function createFinisher(admin: Admin, programId: string, parentWorkoutId: string, finisher: IncomingFinisher, refs: Map<string, string | null>) {
  const id = randomUUID()
  check(
    await admin.from('program_workouts').insert({
      id,
      program_id: programId,
      parent_workout_id: parentWorkoutId,
      order_index: 0,
      ...finisherFields(finisher),
    }),
    'Finisher insert',
  )
  await createExercises(admin, id, finisher.exercises, refs)
}

export async function saveProgramWorkouts(admin: Admin, programId: string, workouts: IncomingWorkout[]) {
  const incoming: IncomingWorkout[] = workouts || []

  const { data: existingWorkouts } = await admin
    .from('program_workouts')
    .select('id')
    .eq('program_id', programId)
    .is('parent_workout_id', null) // parent workouts only, not finishers

  const existingIds = new Set<string>((existingWorkouts || []).map((w: { id: string }) => w.id))
  const incomingIds = new Set<string>(incoming.map((w) => w.id))

  const toUpdate = incoming.filter((w) => existingIds.has(w.id))
  const toAdd = incoming.filter((w) => !existingIds.has(w.id))
  const toDelete = Array.from(existingIds).filter((id) => !incomingIds.has(id))
  const updateIds = toUpdate.map((w) => w.id)

  // Everything the save needs to know, read up front.
  const [refs, finishersResult, logsResult] = await Promise.all([
    loadExerciseRefs(admin, incoming),
    updateIds.length > 0
      ? admin.from('program_workouts').select('id, parent_workout_id').in('parent_workout_id', updateIds)
      : Promise.resolve({ data: [] }),
    toDelete.length > 0
      ? admin.from('workout_logs').select('workout_id').in('workout_id', toDelete)
      : Promise.resolve({ data: [] }),
  ])

  // One existing finisher per parent is updated; none or several falls through
  // to creating a new one, exactly as the old .single() lookup behaved.
  const finishersByParent = new Map<string, string[]>()
  for (const f of (finishersResult.data || []) as { id: string; parent_workout_id: string }[]) {
    if (!finishersByParent.has(f.parent_workout_id)) finishersByParent.set(f.parent_workout_id, [])
    finishersByParent.get(f.parent_workout_id)!.push(f.id)
  }
  const soleFinisher = (parentId: string) => {
    const list = finishersByParent.get(parentId) || []
    return list.length === 1 ? list[0] : null
  }

  // Existing exercise rows for every workout whose exercises get reconciled.
  const syncWorkoutIds: string[] = [...updateIds]
  for (const w of toUpdate) {
    const fid = w.finisher ? soleFinisher(w.id) : null
    if (fid) syncWorkoutIds.push(fid)
  }
  const rowsByWorkout = new Map<string, ExistingExerciseRow[]>()
  for (const group of chunk(syncWorkoutIds, 100)) {
    const { data } = await admin
      .from('workout_exercises')
      .select('id, workout_id, exercise_id, order_index')
      .in('workout_id', group)
      .order('order_index', { ascending: true })
    for (const row of (data || []) as ExistingExerciseRow[]) {
      if (!rowsByWorkout.has(row.workout_id)) rowsByWorkout.set(row.workout_id, [])
      rowsByWorkout.get(row.workout_id)!.push(row)
    }
  }

  // Removed workouts: only those nobody has logged; finishers first.
  const logged = new Set<string>((logsResult.data || []).map((l: { workout_id: string }) => l.workout_id))
  const deletable = toDelete.filter((id) => !logged.has(id))
  for (const id of toDelete) {
    if (logged.has(id)) console.log(`Skipping deletion of workout ${id} - has client logs`)
  }
  if (deletable.length > 0) {
    await admin.from('program_workouts').delete().in('parent_workout_id', deletable)
    await admin.from('program_workouts').delete().in('id', deletable) // cascades to exercises + sets
  }

  const updateWorkout = async (workout: IncomingWorkout) => {
    const work: Promise<unknown>[] = [
      admin.from('program_workouts').update(parentWorkoutFields(workout)).eq('id', workout.id),
      syncExercises(admin, workout.id, workout.exercises, rowsByWorkout.get(workout.id) || [], refs),
    ]
    if (workout.finisher) {
      const fid = soleFinisher(workout.id)
      if (fid) {
        work.push(admin.from('program_workouts').update(finisherFields(workout.finisher)).eq('id', fid))
        work.push(syncExercises(admin, fid, workout.finisher.exercises, rowsByWorkout.get(fid) || [], refs))
      } else {
        work.push(createFinisher(admin, programId, workout.id, workout.finisher, refs))
      }
    } else {
      work.push(admin.from('program_workouts').delete().eq('parent_workout_id', workout.id))
    }
    await Promise.all(work)
  }

  const addWorkout = async (workout: IncomingWorkout) => {
    const id = randomUUID()
    check(
      await admin.from('program_workouts').insert({ id, program_id: programId, ...parentWorkoutFields(workout) }),
      'Workout insert',
    )
    await Promise.all([
      createExercises(admin, id, workout.exercises, refs),
      workout.finisher ? createFinisher(admin, programId, id, workout.finisher, refs) : Promise.resolve(),
    ])
  }

  await runLimited(
    [...toUpdate.map((w) => () => updateWorkout(w)), ...toAdd.map((w) => () => addWorkout(w))],
    WORKOUT_CONCURRENCY,
    (task) => task(),
  )
}
