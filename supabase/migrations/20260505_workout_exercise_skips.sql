-- Skipped exercises within a session. Distinct from a logged set (which
-- means "I did this exercise") and from a swap (which means "I did a
-- different exercise"). A skip means "I couldn't / didn't do this one".
-- Optional category + free-text reason so the trainer can see patterns.

CREATE TABLE IF NOT EXISTS workout_exercise_skips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workout_log_id UUID NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
  workout_exercise_id UUID NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  reason_category TEXT CHECK (reason_category IN ('injury','equipment','time','other') OR reason_category IS NULL),
  reason_details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workout_log_id, workout_exercise_id)
);

CREATE INDEX IF NOT EXISTS idx_workout_exercise_skips_client_id ON workout_exercise_skips(client_id);
CREATE INDEX IF NOT EXISTS idx_workout_exercise_skips_workout_log_id ON workout_exercise_skips(workout_log_id);

ALTER TABLE workout_exercise_skips ENABLE ROW LEVEL SECURITY;

-- Clients manage their own skips
CREATE POLICY "Clients read own skips" ON workout_exercise_skips
  FOR SELECT USING (client_id = auth.uid());
CREATE POLICY "Clients insert own skips" ON workout_exercise_skips
  FOR INSERT WITH CHECK (client_id = auth.uid());
CREATE POLICY "Clients update own skips" ON workout_exercise_skips
  FOR UPDATE USING (client_id = auth.uid());
CREATE POLICY "Clients delete own skips" ON workout_exercise_skips
  FOR DELETE USING (client_id = auth.uid());
