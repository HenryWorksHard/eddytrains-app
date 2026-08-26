-- EMERGENCY FIX #2 (2026-08-26): the first cascade migration only fixed
-- the workout_exercises → {set_logs, skips, swaps} edges. The re-audit
-- FK graph found TWO more live cascade paths that destroy the same class
-- of client data:
--
--   1. workout_logs.workout_id → program_workouts ON DELETE CASCADE
--      => DELETE /api/programs/[id] cascades:
--         programs → program_workouts → workout_logs → set_logs
--      One "Delete program" click wipes ALL assigned clients' logged
--      history for that program. Live exposure at discovery: 301
--      workout_logs, 1,349 set_logs.
--
--   2. client_exercise_sets.workout_exercise_id → workout_exercises
--      ON DELETE CASCADE => every program EDIT (delete-recreate of
--      workout_exercises) destroys the client's per-exercise set
--      customizations. Live exposure: 186 rows.
--
-- Fix: both edges → SET NULL. workout_logs already snapshots exercise
-- names on its set_logs (previous migration), and completion lookups key
-- on (client_id, scheduled_date) so a null workout_id still resolves the
-- session. The program-delete route ALSO gets a code-level guard (blocks
-- delete when child logs exist; super_admin ?force=true override).
--
-- Already applied to prod via Supabase MCP on 2026-08-26; this file tracks it.

BEGIN;

-- 1. workout_logs.workout_id → SET NULL
ALTER TABLE workout_logs ALTER COLUMN workout_id DROP NOT NULL;
ALTER TABLE workout_logs DROP CONSTRAINT workout_logs_workout_id_fkey;
ALTER TABLE workout_logs ADD CONSTRAINT workout_logs_workout_id_fkey
  FOREIGN KEY (workout_id) REFERENCES program_workouts(id) ON DELETE SET NULL;

-- 2. client_exercise_sets.workout_exercise_id → SET NULL
ALTER TABLE client_exercise_sets ALTER COLUMN workout_exercise_id DROP NOT NULL;
ALTER TABLE client_exercise_sets DROP CONSTRAINT client_exercise_sets_workout_exercise_id_fkey;
ALTER TABLE client_exercise_sets ADD CONSTRAINT client_exercise_sets_workout_exercise_id_fkey
  FOREIGN KEY (workout_exercise_id) REFERENCES workout_exercises(id) ON DELETE SET NULL;

COMMIT;
NOTIFY pgrst, 'reload schema';
