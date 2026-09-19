-- 2026-09-10: repair for the two faults behind "my weights didn't save"
-- (Chris Vosloo, and the same pattern going back to April for two others).
-- Data repair only — the code fixes are in api/programs/update (syncExercises)
-- and workout/[id]/page.tsx (single timezone-resolved date).
--
-- 1. RE-LINK ORPHANED SETS.
--    set_logs.exercise_id -> workout_exercises.id is ON DELETE SET NULL. The
--    program editor deleted and recreated every workout_exercises row on each
--    save, so the client's logged sets survived but lost their link: 98 rows
--    (6.7% of all sets) with exercise_id NULL. The weights were in the
--    database the whole time; the app simply could not find them. Every one
--    carried its exercise_name snapshot, so all 98 were recoverable.

with orphan as (
  select sl.id, sl.workout_log_id, sl.set_number, sl.exercise_name, wl.workout_id
  from set_logs sl join workout_logs wl on wl.id = sl.workout_log_id
  where sl.exercise_id is null
), matched as (
  select distinct on (o.id) o.id, we.id target_we
  from orphan o
  join workout_exercises we
    on we.workout_id = o.workout_id and we.exercise_name = o.exercise_name
  where not exists (
    select 1 from set_logs x
    where x.workout_log_id = o.workout_log_id
      and x.exercise_id = we.id and x.set_number = o.set_number)
  order by o.id, we.order_index
)
update set_logs sl set exercise_id = m.target_we
from matched m where sl.id = m.id;

-- 2. MERGE DUPLICATE SESSION LOGS.
--    workout/[id]/page.tsx handed WorkoutClient the raw URL param (undefined
--    for today) and CompleteWorkoutButton a server-resolved UTC date. The
--    first fell back to the DEVICE-LOCAL date, the second was UTC. For an
--    Adelaide client training late evening UTC those are different days, so
--    the unique index on (client_id, workout_id, scheduled_date) never fired
--    and each session produced two rows: one holding the sets, and a second
--    empty one created moments later by the Complete button. The empty row
--    was newer AND owned the workout_completion, so opening the completed
--    workout showed nothing. 11 such rows across 3 clients since April.
--
--    Repoint the completion at the row that actually holds the sets, then
--    drop the empty shell.

with logs as (
  select wl.id, wl.client_id, wl.workout_id, wl.created_at,
         (select count(*) from set_logs sl where sl.workout_log_id = wl.id) sets
  from workout_logs wl
), pairs as (
  select distinct on (a.id) a.id empty_id, b.id real_id
  from logs a join logs b
    on a.client_id = b.client_id and a.workout_id = b.workout_id and a.id <> b.id
  where a.sets = 0 and b.sets > 0
    and abs(extract(epoch from (a.created_at - b.created_at))) < 86400
  order by a.id, b.sets desc, b.created_at desc
)
update workout_completions wc
set workout_log_id = p.real_id
from pairs p
where wc.workout_log_id = p.empty_id;

with logs as (
  select wl.id, wl.client_id, wl.workout_id, wl.created_at,
         (select count(*) from set_logs sl where sl.workout_log_id = wl.id) sets
  from workout_logs wl
), empties as (
  select distinct a.id
  from logs a join logs b
    on a.client_id = b.client_id and a.workout_id = b.workout_id and a.id <> b.id
  where a.sets = 0 and b.sets > 0
    and abs(extract(epoch from (a.created_at - b.created_at))) < 86400
)
delete from workout_logs wl
using empties e
where wl.id = e.id
  and not exists (select 1 from set_logs sl where sl.workout_log_id = wl.id)
  and not exists (select 1 from workout_completions wc where wc.workout_log_id = wl.id);
