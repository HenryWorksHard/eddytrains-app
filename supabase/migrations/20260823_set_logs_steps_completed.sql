-- Audit finding (2026-08-23): steps-based exercises (currently only ones
-- matching name === 'steps') have a code path in WheelPicker that returns
-- a steps value, ExerciseCard stores it in local state, but the upsert
-- to set_logs never persists it — set_logs has no `steps_completed`
-- column. Users log steps, see the green check, reload → gone.
--
-- Add the column. Nullable — most exercises don't use it. Not indexed
-- (never used in WHERE clauses).

ALTER TABLE set_logs
  ADD COLUMN IF NOT EXISTS steps_completed INTEGER;

NOTIFY pgrst, 'reload schema';
