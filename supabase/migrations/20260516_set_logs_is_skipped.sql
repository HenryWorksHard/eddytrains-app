-- Per-set skip flag. Distinct from per-exercise skip (which lives in
-- workout_exercise_skips and marks the WHOLE exercise as opted out):
-- this flags a single set within an otherwise-active exercise.
-- weight_kg + reps_completed stay null on a skipped set; the boolean
-- disambiguates "not logged yet" (null + is_skipped=false) from
-- "deliberately skipped" (null + is_skipped=true).

ALTER TABLE set_logs
  ADD COLUMN IF NOT EXISTS is_skipped BOOLEAN NOT NULL DEFAULT false;
