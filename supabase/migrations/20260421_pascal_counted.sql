-- Tracks which workout_completions have already been credited to the
-- user's Pascal score. Replaces the buggy "short-circuit if last_processed
-- is today" logic — new completions throughout the day now credit even
-- after the daily replay has already run.

ALTER TABLE workout_completions
  ADD COLUMN IF NOT EXISTS pascal_counted BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_workout_completions_pascal_uncounted
  ON workout_completions(client_id)
  WHERE pascal_counted = FALSE;

-- Grandfather existing completions as counted so they don't retroactively
-- bump existing users' scores.
UPDATE workout_completions SET pascal_counted = TRUE WHERE pascal_counted = FALSE;
