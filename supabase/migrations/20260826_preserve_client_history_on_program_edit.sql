-- EMERGENCY FIX (2026-08-26): set_logs.exercise_id had ON DELETE CASCADE
-- to workout_exercises. The program-update flow deletes + recreates
-- workout_exercises on every edit ("simpler approach: delete and
-- recreate" — src/app/api/programs/update/route.ts), so every weekly
-- program edit CASCADE-DELETED all client set history for the affected
-- exercises.
--
-- Verified in prod: a client's Aug 17-21 workouts had 18-21 sets each
-- when checked on Aug 17; by Aug 26 all were 0 (only the newest, not
-- yet edited over, survived). This — not the autosave — was the true
-- root cause of "weights don't save", "weights don't carry over to
-- next week", and the 88% empty-completion mystery. The autosave
-- telemetry (PR #37) proved saves landed 82/82; the data was then
-- destroyed retroactively by trainer program edits.
--
-- Fix: client history tables now SET NULL instead of CASCADE, and
-- set_logs snapshots the exercise name at save time so history remains
-- meaningful after the template row is gone. exercise_sets (the
-- template's own sets) intentionally KEEPS its cascade — those rows are
-- part of the template being replaced, not client history.
--
-- Already applied to prod via Supabase MCP on 2026-08-26; this file
-- tracks it.

BEGIN;

-- set_logs: history must survive template rebuilds
ALTER TABLE set_logs ALTER COLUMN exercise_id DROP NOT NULL;
ALTER TABLE set_logs DROP CONSTRAINT set_logs_exercise_id_fkey;
ALTER TABLE set_logs ADD CONSTRAINT set_logs_exercise_id_fkey
  FOREIGN KEY (exercise_id) REFERENCES workout_exercises(id) ON DELETE SET NULL;
ALTER TABLE set_logs ADD COLUMN IF NOT EXISTS exercise_name TEXT;

-- Backfill snapshot from the rows whose template still exists
UPDATE set_logs sl
SET exercise_name = we.exercise_name
FROM workout_exercises we
WHERE sl.exercise_id = we.id
  AND sl.exercise_name IS NULL;

-- skip history survives template rebuilds
ALTER TABLE workout_exercise_skips ALTER COLUMN workout_exercise_id DROP NOT NULL;
ALTER TABLE workout_exercise_skips DROP CONSTRAINT workout_exercise_skips_workout_exercise_id_fkey;
ALTER TABLE workout_exercise_skips ADD CONSTRAINT workout_exercise_skips_workout_exercise_id_fkey
  FOREIGN KEY (workout_exercise_id) REFERENCES workout_exercises(id) ON DELETE SET NULL;

-- swap history survives template rebuilds
ALTER TABLE workout_exercise_swaps ALTER COLUMN workout_exercise_id DROP NOT NULL;
ALTER TABLE workout_exercise_swaps DROP CONSTRAINT workout_exercise_swaps_workout_exercise_id_fkey;
ALTER TABLE workout_exercise_swaps ADD CONSTRAINT workout_exercise_swaps_workout_exercise_id_fkey
  FOREIGN KEY (workout_exercise_id) REFERENCES workout_exercises(id) ON DELETE SET NULL;

COMMIT;
NOTIFY pgrst, 'reload schema';
