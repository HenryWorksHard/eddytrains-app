-- Per-session exercise swap. Mirrors workout_exercise_skips: one row per
-- workout_log + workout_exercise slot, holding the substituted name +
-- whether it's a custom exercise. Lets the swap state persist as soon as
-- the user picks a replacement — even if they leave the page before
-- logging any sets (set_logs.swapped_exercise_name only fills in after a
-- set is saved, which is why swaps used to disappear on revisit).

CREATE TABLE IF NOT EXISTS workout_exercise_swaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workout_log_id UUID NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
  workout_exercise_id UUID NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  substituted_exercise_name TEXT NOT NULL,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  custom_exercise_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workout_log_id, workout_exercise_id)
);

CREATE INDEX IF NOT EXISTS idx_workout_exercise_swaps_client_id ON workout_exercise_swaps(client_id);
CREATE INDEX IF NOT EXISTS idx_workout_exercise_swaps_workout_log_id ON workout_exercise_swaps(workout_log_id);

ALTER TABLE workout_exercise_swaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients read own swaps" ON workout_exercise_swaps
  FOR SELECT USING (client_id = auth.uid());
CREATE POLICY "Clients insert own swaps" ON workout_exercise_swaps
  FOR INSERT WITH CHECK (client_id = auth.uid());
CREATE POLICY "Clients update own swaps" ON workout_exercise_swaps
  FOR UPDATE USING (client_id = auth.uid());
CREATE POLICY "Clients delete own swaps" ON workout_exercise_swaps
  FOR DELETE USING (client_id = auth.uid());
