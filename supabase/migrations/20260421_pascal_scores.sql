-- Pascal fitness-score mascot. One row per client. Score represents
-- consistency and is replayed lazily from workout_completions whenever
-- /api/pascal is called; the `last_processed_date` watermark tells us
-- where to resume from.
--
-- Score rules (enforced in /api/pascal, not in the DB):
--   +10 per completed workout on a day
--   -15 if a scheduled workout day had no completion
--   -2  per day with no completion that wasn't a scheduled day (decay)
--   Clamp [0, 200]

CREATE TABLE IF NOT EXISTS pascal_scores (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  score INT NOT NULL DEFAULT 100 CHECK (score >= 0 AND score <= 200),
  -- Last calendar date whose +10/-15/-2 deltas have been applied to `score`.
  -- NULL on brand-new rows; the route treats it as "created today" for
  -- the first visit so new users start at 100 without an instant penalty.
  last_processed_date DATE,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pascal_scores ENABLE ROW LEVEL SECURITY;

-- Users can read, insert, and update only their own row.
-- No delete policy — rows cascade-clean from auth.users.

CREATE POLICY "Users can read own pascal score"
  ON pascal_scores FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own pascal score"
  ON pascal_scores FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own pascal score"
  ON pascal_scores FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE pascal_scores IS
  'Fitness-consistency score for the Pascal mascot. Replayed from workout_completions in /api/pascal; last_processed_date is the watermark.';
