// Differential test: the batched saveProgramWorkouts (src/app/lib/program-save.ts)
// must leave the database in exactly the state the old sequential loop did.
//
//   node --experimental-strip-types --no-warnings scripts/test-program-save.mjs
//
// Both run against an in-memory database that enforces the real foreign keys
// (parent row must exist on insert; ON DELETE CASCADE for program_workouts ->
// finishers, program_workouts -> workout_exercises -> exercise_sets), so a
// write issued in the wrong order fails here the way it would in Postgres.
import { randomUUID } from 'crypto'
import { saveProgramWorkouts } from '../src/app/lib/program-save.ts'

// ---------------------------------------------------------------- mock db
const TABLES = ['programs', 'program_workouts', 'workout_exercises', 'exercise_sets', 'exercises', 'workout_logs']
const DEFAULTS = {
  program_workouts: { category: null, parent_workout_id: null, notes: null, is_emom: false, emom_interval: null,
    is_superset: false, warmup_exercises: [], recovery_notes: null, week_number: 1, day_of_week: null, order_index: 0 },
  workout_exercises: { notes: null, superset_group: null, exercise_uuid: null, category: 'strength', order_index: 0 },
  exercise_sets: {},
}
const clone = (x) => JSON.parse(JSON.stringify(x))

function makeDb(seed) {
  const db = Object.fromEntries(TABLES.map((t) => [t, clone(seed[t] || [])]))
  const fail = (msg) => ({ data: null, error: { message: msg } })

  function cascadeDelete(table, ids) {
    const gone = new Set(ids)
    db[table] = db[table].filter((r) => !gone.has(r.id))
    if (table === 'program_workouts') {
      const kids = db.program_workouts.filter((r) => gone.has(r.parent_workout_id)).map((r) => r.id)
      if (kids.length) cascadeDelete('program_workouts', kids)
      const ex = db.workout_exercises.filter((r) => gone.has(r.workout_id)).map((r) => r.id)
      if (ex.length) cascadeDelete('workout_exercises', ex)
    }
    if (table === 'workout_exercises') {
      db.exercise_sets = db.exercise_sets.filter((r) => !gone.has(r.exercise_id))
    }
  }

  function fkOk(table, row) {
    if (table === 'program_workouts') {
      if (row.parent_workout_id && !db.program_workouts.some((w) => w.id === row.parent_workout_id)) return 'fk parent_workout_id'
    }
    if (table === 'workout_exercises' && !db.program_workouts.some((w) => w.id === row.workout_id)) return 'fk workout_id'
    if (table === 'exercise_sets' && !db.workout_exercises.some((e) => e.id === row.exercise_id)) return 'fk exercise_id'
    return null
  }

  class Q {
    constructor(table) { Object.assign(this, { table, op: 'select', filters: [], mode: 'many', orderBy: null, lim: null, payload: null, returning: false }) }
    select() { if (this.op !== 'select') this.returning = true; return this }
    insert(rows) { this.op = 'insert'; this.payload = Array.isArray(rows) ? rows : [rows]; return this }
    update(obj) { this.op = 'update'; this.payload = obj; return this }
    delete() { this.op = 'delete'; return this }
    eq(c, v) { this.filters.push((r) => r[c] === v); return this }
    is(c, v) { this.filters.push((r) => (r[c] ?? null) === v); return this }
    in(c, arr) { const s = new Set(arr); this.filters.push((r) => s.has(r[c])); return this }
    order(c, o = {}) { this.orderBy = [c, o.ascending !== false]; return this }
    limit(n) { this.lim = n; return this }
    single() { this.mode = 'single'; return this }
    maybeSingle() { this.mode = 'maybe'; return this }
    match() { return db[this.table].filter((r) => this.filters.every((f) => f(r))) }
    shape(rows) {
      rows = clone(rows)
      if (this.orderBy) { const [c, asc] = this.orderBy; rows.sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1)) }
      if (this.lim != null) rows = rows.slice(0, this.lim)
      if (this.mode === 'single') return rows.length === 1 ? { data: rows[0], error: null } : fail('single: ' + rows.length + ' rows')
      if (this.mode === 'maybe') return rows.length <= 1 ? { data: rows[0] ?? null, error: null } : fail('maybeSingle: ' + rows.length + ' rows')
      return { data: rows, error: null }
    }
    run() {
      const t = this.table
      if (this.op === 'select') return this.shape(this.match())
      if (this.op === 'insert') {
        const made = []
        for (const r of this.payload) {
          const row = { ...clone(DEFAULTS[t] || {}), id: randomUUID(), ...clone(r) }
          const bad = fkOk(t, row); if (bad) return fail(bad)
          db[t].push(row); made.push(row)
        }
        return this.returning ? this.shape(made) : { data: null, error: null }
      }
      if (this.op === 'update') {
        const rows = this.match(); rows.forEach((r) => Object.assign(r, clone(this.payload)))
        return this.returning ? this.shape(rows) : { data: null, error: null }
      }
      if (this.op === 'delete') { cascadeDelete(t, this.match().map((r) => r.id)); return { data: null, error: null } }
    }
    then(res, rej) { return Promise.resolve().then(() => this.run()).then(res, rej) }
  }
  return { client: { from: (t) => new Q(t) }, db }
}

// ------------------------------------------ old implementation, verbatim
// Transcribed from origin/main src/app/api/programs/update/route.ts steps 2-6
// and its syncExercises / createExercises / createFinisher helpers.
async function oldSave(supabaseAdmin, id, workouts) {
  const { data: existingWorkouts } = await supabaseAdmin.from('program_workouts').select('id').eq('program_id', id).is('parent_workout_id', null)
  const existingWorkoutIds = new Set(existingWorkouts?.map((w) => w.id) || [])
  const incomingWorkoutIds = new Set(workouts?.map((w) => w.id) || [])
  const workoutsToAdd = [], workoutsToUpdate = []
  for (const workout of (workouts || [])) (existingWorkoutIds.has(workout.id) ? workoutsToUpdate : workoutsToAdd).push(workout)
  const workoutIdsToDelete = []
  for (const existingId of existingWorkoutIds) if (!incomingWorkoutIds.has(existingId)) workoutIdsToDelete.push(existingId)
  for (const workoutId of workoutIdsToDelete) {
    const { data: logs } = await supabaseAdmin.from('workout_logs').select('id').eq('workout_id', workoutId).limit(1)
    if (logs && logs.length > 0) continue
    await supabaseAdmin.from('program_workouts').delete().eq('parent_workout_id', workoutId)
    await supabaseAdmin.from('program_workouts').delete().eq('id', workoutId)
  }
  for (const workout of workoutsToUpdate) {
    await supabaseAdmin.from('program_workouts').update({
      name: workout.name, day_of_week: workout.dayOfWeek, order_index: workout.order, notes: workout.notes || null,
      is_emom: workout.isEmom || false, emom_interval: workout.emomInterval || null, warmup_exercises: workout.warmupExercises || [],
      recovery_notes: workout.recoveryNotes || null, week_number: workout.weekNumber || 1,
    }).eq('id', workout.id)
    await oldSync(supabaseAdmin, workout.id, workout.exercises)
    if (workout.finisher) {
      const { data: existingFinisher } = await supabaseAdmin.from('program_workouts').select('id').eq('parent_workout_id', workout.id).single()
      if (existingFinisher) {
        await supabaseAdmin.from('program_workouts').update({
          name: workout.finisher.name, category: workout.finisher.category, notes: workout.finisher.notes || null,
          is_emom: workout.finisher.isEmom || false, emom_interval: workout.finisher.emomInterval || null, is_superset: workout.finisher.isSuperset || false,
        }).eq('id', existingFinisher.id)
        await oldSync(supabaseAdmin, existingFinisher.id, workout.finisher.exercises)
      } else {
        await oldCreateFinisher(supabaseAdmin, id, workout.id, workout.finisher)
      }
    } else {
      await supabaseAdmin.from('program_workouts').delete().eq('parent_workout_id', workout.id)
    }
  }
  for (const workout of workoutsToAdd) {
    const { data: workoutData, error: workoutError } = await supabaseAdmin.from('program_workouts').insert({
      program_id: id, name: workout.name, day_of_week: workout.dayOfWeek, order_index: workout.order, notes: workout.notes || null,
      is_emom: workout.isEmom || false, emom_interval: workout.emomInterval || null, warmup_exercises: workout.warmupExercises || [],
      recovery_notes: workout.recoveryNotes || null, week_number: workout.weekNumber || 1,
    }).select().single()
    if (workoutError) throw workoutError
    await oldCreateExercises(supabaseAdmin, workoutData.id, workout.exercises)
    if (workout.finisher) await oldCreateFinisher(supabaseAdmin, id, workoutData.id, workout.finisher)
  }
}
const oldSetRow = (exercise_id, set) => ({
  exercise_id, set_number: set.setNumber, reps: set.reps, intensity_type: set.intensityType, intensity_value: set.intensityValue,
  rest_seconds: set.restSeconds, rest_bracket: set.restBracket || '90-120', weight_type: set.weightType || 'freeweight', notes: set.notes || null,
  cardio_type: set.cardioType || null, cardio_value: set.cardioValue || null, cardio_unit: set.cardioUnit || null, heart_rate_zone: set.heartRateZone || null,
  work_time: set.workTime || null, rest_time: set.restTime || null, hyrox_station: set.hyroxStation || null, hyrox_distance: set.hyroxDistance || null,
  hyrox_unit: set.hyroxUnit || null, hyrox_target_time: set.hyroxTargetTime || null, hyrox_weight_class: set.hyroxWeightClass || null,
})
async function oldSync(supabaseAdmin, workoutId, exercises) {
  const incoming = exercises || []
  const { data: existingRows } = await supabaseAdmin.from('workout_exercises').select('id, exercise_id, order_index').eq('workout_id', workoutId).order('order_index', { ascending: true })
  const reusable = new Map()
  for (const row of existingRows || []) { if (!row.exercise_id) continue; const k = String(row.exercise_id); if (!reusable.has(k)) reusable.set(k, []); reusable.get(k).push(row.id) }
  for (const exercise of incoming) {
    const { data: exerciseRef } = await supabaseAdmin.from('exercises').select('id').eq('name', exercise.exerciseName).maybeSingle()
    const payload = { workout_id: workoutId, exercise_id: exercise.exerciseId, exercise_name: exercise.exerciseName, exercise_uuid: exerciseRef?.id || null,
      category: exercise.category || 'strength', order_index: exercise.order, notes: exercise.notes || null, superset_group: exercise.supersetGroup || null }
    const key = exercise.exerciseId ? String(exercise.exerciseId) : null
    let rowId = key ? reusable.get(key)?.shift() : undefined
    if (rowId) {
      const { error } = await supabaseAdmin.from('workout_exercises').update(payload).eq('id', rowId); if (error) throw error
      await supabaseAdmin.from('exercise_sets').delete().eq('exercise_id', rowId)
    } else {
      const { data: created, error } = await supabaseAdmin.from('workout_exercises').insert(payload).select('id').single(); if (error) throw error
      rowId = created.id
    }
    if (exercise.sets?.length > 0 && rowId) {
      const { error } = await supabaseAdmin.from('exercise_sets').insert(exercise.sets.map((s) => oldSetRow(rowId, s))); if (error) throw error
    }
  }
  const staleIds = Array.from(reusable.values()).flat()
  if (staleIds.length > 0) await supabaseAdmin.from('workout_exercises').delete().in('id', staleIds)
}
async function oldCreateExercises(supabaseAdmin, workoutId, exercises) {
  if (!exercises || exercises.length === 0) return
  for (const exercise of exercises) {
    const { data: exerciseRef } = await supabaseAdmin.from('exercises').select('id').eq('name', exercise.exerciseName).single()
    const { data: exerciseData, error } = await supabaseAdmin.from('workout_exercises').insert({
      workout_id: workoutId, exercise_id: exercise.exerciseId, exercise_name: exercise.exerciseName, exercise_uuid: exerciseRef?.id || null,
      category: exercise.category || 'strength', order_index: exercise.order, notes: exercise.notes || null, superset_group: exercise.supersetGroup || null,
    }).select().single()
    if (error) throw error
    if (exercise.sets?.length > 0 && exerciseData) {
      const { error: e2 } = await supabaseAdmin.from('exercise_sets').insert(exercise.sets.map((s) => oldSetRow(exerciseData.id, s))); if (e2) throw e2
    }
  }
}
async function oldCreateFinisher(supabaseAdmin, programId, parentWorkoutId, finisher) {
  const { data: finisherData, error } = await supabaseAdmin.from('program_workouts').insert({
    program_id: programId, parent_workout_id: parentWorkoutId, name: finisher.name, category: finisher.category, order_index: 0,
    notes: finisher.notes || null, is_emom: finisher.isEmom || false, emom_interval: finisher.emomInterval || null, is_superset: finisher.isSuperset || false,
  }).select().single()
  if (error) throw error
  await oldCreateExercises(supabaseAdmin, finisherData.id, finisher.exercises)
}

// -------------------------------------------------------- canonical state
// Rows that existed before the save keep their real id (the new code must
// preserve every one of them). Rows created by the save get a structural
// name, since each implementation generates different random ids.
function canonical(db, seedIds) {
  const name = new Map()
  const idOf = (id) => (id == null ? null : seedIds.has(id) ? id : name.get(id) ?? 'UNRESOLVED:' + id)
  const pw = [...db.program_workouts]
  for (let pass = 0; pass < 3; pass++) for (const w of pw) if (!seedIds.has(w.id))
    name.set(w.id, `PW(${w.program_id}|${idOf(w.parent_workout_id)}|${w.name}|${w.order_index}|${w.week_number})`)
  for (const e of db.workout_exercises) if (!seedIds.has(e.id))
    name.set(e.id, `WE(${idOf(e.workout_id)}|${e.order_index}|${e.exercise_id}|${e.exercise_name})`)
  const norm = (t, rows, drop = []) => rows.map((r) => {
    const o = {}
    for (const [k, v] of Object.entries(r)) {
      if (drop.includes(k)) continue
      o[k] = ['id', 'workout_id', 'parent_workout_id', 'exercise_id'].includes(k) && !(t === 'workout_exercises' && k === 'exercise_id') ? idOf(v) : v
    }
    return JSON.stringify(o, Object.keys(o).sort())
  }).sort()
  return {
    program_workouts: norm('program_workouts', db.program_workouts),
    workout_exercises: norm('workout_exercises', db.workout_exercises),
    exercise_sets: norm('exercise_sets', db.exercise_sets, ['id']), // set ids are regenerated by both
  }
}

// ------------------------------------------------------------- scenarios
const P = 'prog-1'
const LIB = [
  { id: 'lib-squat', name: 'Squat' }, { id: 'lib-bench', name: 'Bench' }, { id: 'lib-row', name: 'Row' },
  { id: 'lib-plank', name: 'Plank' }, { id: 'lib-dup-a', name: 'Dup Name' }, { id: 'lib-dup-b', name: 'Dup Name' },
  { id: 'lib-curl', name: 'Curl (Lying/Seated)' },
]
const mkSet = (n, r = '10') => ({ setNumber: n, reps: r, intensityType: 'rir', intensityValue: '2', restSeconds: 90 })
const mkEx = (exerciseId, exerciseName, order, nSets = 3, extra = {}) =>
  ({ exerciseId, exerciseName, order, category: 'strength', sets: Array.from({ length: nSets }, (_, i) => mkSet(i + 1)), ...extra })

function seedFixture() {
  const s = { programs: [{ id: P }], exercises: clone(LIB), program_workouts: [], workout_exercises: [], exercise_sets: [], workout_logs: [] }
  const w = (id, name, order, extra = {}) => s.program_workouts.push({ ...DEFAULTS.program_workouts, id, program_id: P, name, order_index: order, ...extra })
  const e = (id, workout_id, exercise_id, exercise_name, order_index) => {
    s.workout_exercises.push({ ...DEFAULTS.workout_exercises, id, workout_id, exercise_id, exercise_name, order_index })
    for (let n = 1; n <= 3; n++) s.exercise_sets.push({ id: `${id}-s${n}`, exercise_id: id, set_number: n, reps: '8' })
  }
  w('w-keep', 'Upper', 0); e('we-1', 'w-keep', 'x-bench', 'Bench', 0); e('we-2', 'w-keep', 'x-row', 'Row', 1); e('we-3', 'w-keep', 'x-row', 'Row', 2)
  e('we-null', 'w-keep', null, 'Legacy', 3) // no exercise_id: must be left untouched
  w('w-fin-parent', 'Lower', 1); w('f-1', 'Finisher', 0, { parent_workout_id: 'w-fin-parent', category: 'hiit' }); e('we-f1', 'f-1', 'x-plank', 'Plank', 0)
  w('w-two-fin', 'Full', 2); w('f-2a', 'FinA', 0, { parent_workout_id: 'w-two-fin' }); w('f-2b', 'FinB', 0, { parent_workout_id: 'w-two-fin' })
  w('w-drop-finisher', 'Arms', 3); w('f-3', 'Pump', 0, { parent_workout_id: 'w-drop-finisher' }); e('we-f3', 'f-3', 'x-curl', 'Curl (Lying/Seated)', 0)
  w('w-remove', 'Old', 4); e('we-r', 'w-remove', 'x-squat', 'Squat', 0); w('f-r', 'OldFin', 0, { parent_workout_id: 'w-remove' })
  w('w-remove-logged', 'Logged', 5); e('we-l', 'w-remove-logged', 'x-squat', 'Squat', 0)
  s.workout_logs.push({ id: 'log-1', workout_id: 'w-remove-logged' })
  return s
}

const payloadFixture = [
  { id: 'w-keep', name: 'Upper v2', order: 0, dayOfWeek: 1, weekNumber: 1, exercises: [
      mkEx('x-row', 'Row', 0, 4), mkEx('x-bench', 'Bench', 1), mkEx('x-row', 'Row', 2), mkEx('x-row', 'Row', 3, 2), // 3rd Row is new
      mkEx(null, 'Freestyle', 4, 1), mkEx('x-dup', 'Dup Name', 5), mkEx('x-missing', 'Not In Library', 6),
  ] },
  { id: 'w-fin-parent', name: 'Lower', order: 1, dayOfWeek: 3, exercises: [mkEx('x-squat', 'Squat', 0)],
    finisher: { name: 'Finisher v2', category: 'emom', isEmom: true, emomInterval: 60, exercises: [mkEx('x-plank', 'Plank', 0, 2), mkEx('x-curl', 'Curl (Lying/Seated)', 1)] } },
  { id: 'w-two-fin', name: 'Full', order: 2, exercises: [], finisher: { name: 'FinC', category: 'hiit', exercises: [mkEx('x-plank', 'Plank', 0)] } },
  { id: 'w-drop-finisher', name: 'Arms', order: 3, exercises: [mkEx('x-curl', 'Curl (Lying/Seated)', 0)] },
  { id: 'tmp-new-1', name: 'Brand New', order: 6, dayOfWeek: 5, weekNumber: 2, warmupExercises: [{ n: 1 }], exercises: [mkEx('x-squat', 'Squat', 0), mkEx('x-bench', 'Bench', 1)],
    finisher: { name: 'New Fin', category: 'hiit', isSuperset: true, exercises: [mkEx('x-row', 'Row', 0)] } },
  { id: 'tmp-new-2', name: 'Empty', order: 7, exercises: [] },
]

// Random programs: re-order, add, drop and duplicate exercises; add/remove
// workouts and finishers.
function rng(seed) { let s = seed; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296 }
function randomCase(seed) {
  const r = rng(seed), pick = (a) => a[Math.floor(r() * a.length)]
  const s = seedFixture()
  const lib = ['x-squat', 'x-bench', 'x-row', 'x-plank', 'x-curl', 'x-dup', null]
  const names = { 'x-squat': 'Squat', 'x-bench': 'Bench', 'x-row': 'Row', 'x-plank': 'Plank', 'x-curl': 'Curl (Lying/Seated)', 'x-dup': 'Dup Name' }
  const parents = s.program_workouts.filter((w) => !w.parent_workout_id)
  const payload = []
  for (const w of parents) {
    if (r() < 0.2) continue // dropped from the program
    const exs = Array.from({ length: Math.floor(r() * 6) }, (_, i) => { const id = pick(lib); return mkEx(id, id ? names[id] : 'Custom ' + i, i, 1 + Math.floor(r() * 4)) })
    const wk = { id: w.id, name: w.name + (r() < 0.5 ? '*' : ''), order: w.order_index, dayOfWeek: Math.floor(r() * 7), weekNumber: 1 + Math.floor(r() * 3), exercises: exs }
    if (r() < 0.6) wk.finisher = { name: 'F' + seed, category: pick(['hiit', 'emom']), exercises: Array.from({ length: Math.floor(r() * 3) }, (_, i) => mkEx(pick(lib.slice(0, 5)), names[pick(lib.slice(0, 5))] || 'Squat', i)) }
    payload.push(wk)
  }
  for (let n = 0; n < Math.floor(r() * 3); n++) payload.push({ id: 'tmp-' + seed + '-' + n, name: 'New ' + n, order: 10 + n, exercises: [mkEx('x-squat', 'Squat', 0)],
    ...(r() < 0.5 ? { finisher: { name: 'NF', category: 'hiit', exercises: [mkEx('x-plank', 'Plank', 0)] } } : {}) })
  return { seed: s, payload }
}

// ------------------------------------------------------------------ run
async function compare(label, seed, payload) {
  const seedIds = new Set([...seed.program_workouts, ...seed.workout_exercises].map((r) => r.id))
  const a = makeDb(seed), b = makeDb(seed)
  let errA = null, errB = null
  try { await oldSave(a.client, P, clone(payload)) } catch (e) { errA = e.message || String(e) }
  try { await saveProgramWorkouts(b.client, P, clone(payload)) } catch (e) { errB = e.message || String(e) }
  if (!!errA !== !!errB) throw new Error(`${label}: old ${errA ? 'threw ' + errA : 'succeeded'}, new ${errB ? 'threw ' + errB : 'succeeded'}`)
  const ca = canonical(a.db, seedIds), cb = canonical(b.db, seedIds)
  for (const t of Object.keys(ca)) {
    const x = JSON.stringify(ca[t]), y = JSON.stringify(cb[t])
    if (x !== y) {
      const onlyA = ca[t].filter((row) => !cb[t].includes(row)), onlyB = cb[t].filter((row) => !ca[t].includes(row))
      throw new Error(`${label}: ${t} differs\n  old only: ${onlyA.slice(0, 3).join('\n            ')}\n  new only: ${onlyB.slice(0, 3).join('\n            ')}`)
    }
  }
  return { rows: Object.values(cb).reduce((n, t) => n + t.length, 0), threw: !!errB }
}

const results = []
results.push(['fixture', await compare('fixture', seedFixture(), payloadFixture)])
// The fixture must genuinely exercise the edge cases it claims to.
{
  const b = makeDb(seedFixture()); await saveProgramWorkouts(b.client, P, clone(payloadFixture))
  const has = (t, pred) => b.db[t].some(pred)
  const assert = (ok, what) => { if (!ok) throw new Error('fixture coverage: ' + what) }
  assert(has('workout_exercises', (e) => e.id === 'we-1') && has('workout_exercises', (e) => e.id === 'we-2') && has('workout_exercises', (e) => e.id === 'we-3'), 'matched rows keep their ids')
  assert(has('workout_exercises', (e) => e.id === 'we-null'), 'row with no exercise_id left untouched')
  assert(!has('program_workouts', (w) => w.id === 'w-remove') && !has('program_workouts', (w) => w.id === 'f-r'), 'unlogged workout + its finisher removed')
  assert(has('program_workouts', (w) => w.id === 'w-remove-logged'), 'logged workout kept')
  assert(!has('program_workouts', (w) => w.id === 'f-3'), 'finisher dropped when none sent')
  assert(b.db.program_workouts.filter((w) => w.parent_workout_id === 'w-two-fin').length === 3, 'two existing finishers -> a third is created, as before')
  assert(b.db.workout_exercises.find((e) => e.exercise_name === 'Dup Name')?.exercise_uuid === null, 'ambiguous library name -> null uuid')
  assert(b.db.workout_exercises.find((e) => e.exercise_name === 'Curl (Lying/Seated)')?.exercise_uuid === 'lib-curl', 'name with parentheses resolves')
}
let fuzz = 0
for (let seed = 1; seed <= 400; seed++) { const { seed: s, payload } = randomCase(seed); await compare('random#' + seed, s, payload); fuzz++ }
console.log(`PASS  fixture (${results[0][1].rows} rows compared, coverage asserted) + ${fuzz} randomised programs — old and new leave identical databases`)
