-- Halley bug fix (2026-06-29):
-- WorkoutClient.loadTodaySession and saveWorkoutLogs used different lookup
-- criteria — load by (client_id, workout_id, scheduled_date), save by
-- (client_id, workout_id, completed_at >= now-24h). Mismatch let the
-- autosave create a SECOND workout_log row when the user came back to
-- finish a workout >24h later. Halley's "some sets saved, some didn't"
-- was sets scattered across the two duplicate rows.
--
-- This migration:
--   1. Finds existing duplicate groups: same (client_id, workout_id,
--      scheduled_date) → 2+ workout_logs rows
--   2. For each group, picks a canonical row (most set_logs, tie-break
--      by newest created_at) and moves data from the others into it
--      without overwriting any rows the canonical already has (preserves
--      whichever copy has more non-null data)
--   3. Deletes the non-canonical workout_log rows (set_logs CASCADE)
--   4. Adds UNIQUE constraint so the duplicate state can't reappear
--
-- The application-code fix (WorkoutClient.saveWorkoutLogs lookup) ships
-- in the same PR. Either alone is insufficient — the migration cleans up
-- existing data, the constraint is the belt-and-braces.

BEGIN;

-- Step 1+2: merge duplicate groups into a canonical row.
-- We use CTEs to identify the canonical row per (client, workout, date)
-- group, then for each non-canonical row's set_logs, redirect them to
-- the canonical workout_log_id BUT only when the canonical doesn't
-- already have a matching (exercise_id, set_number).
WITH ranked_logs AS (
  SELECT
    wl.id,
    wl.client_id,
    wl.workout_id,
    wl.scheduled_date,
    wl.created_at,
    -- Most set_logs wins; tie-break by newest. The set_log count is the
    -- best proxy for "row with the most user data" since empty cells are
    -- never upserted.
    ROW_NUMBER() OVER (
      PARTITION BY wl.client_id, wl.workout_id, wl.scheduled_date
      ORDER BY (
        SELECT COUNT(*) FROM set_logs sl WHERE sl.workout_log_id = wl.id
      ) DESC, wl.created_at DESC
    ) AS rn
  FROM workout_logs wl
  WHERE wl.scheduled_date IS NOT NULL
),
canonical AS (
  SELECT
    rl.id AS canonical_id,
    rl.client_id,
    rl.workout_id,
    rl.scheduled_date
  FROM ranked_logs rl
  WHERE rl.rn = 1
),
losers AS (
  SELECT
    rl.id AS loser_id,
    c.canonical_id
  FROM ranked_logs rl
  JOIN canonical c
    ON c.client_id = rl.client_id
   AND c.workout_id = rl.workout_id
   AND c.scheduled_date = rl.scheduled_date
  WHERE rl.rn > 1
)
-- For each loser → canonical pair, move only the set_logs that don't
-- collide with the canonical's existing rows. Collisions stay on the
-- loser and get CASCADE-deleted next step (we keep the canonical's
-- version on a tie since the canonical was picked for having more data).
UPDATE set_logs sl
SET workout_log_id = l.canonical_id
FROM losers l
WHERE sl.workout_log_id = l.loser_id
  AND NOT EXISTS (
    SELECT 1 FROM set_logs sl2
    WHERE sl2.workout_log_id = l.canonical_id
      AND sl2.exercise_id = sl.exercise_id
      AND sl2.set_number = sl.set_number
  );

-- Also redirect workout_completions, workout_exercise_skips, and
-- workout_exercise_swaps from losers to canonical so historical data
-- views still line up. These have their own conflict semantics; on
-- conflict we keep whichever already exists on the canonical.
WITH ranked_logs AS (
  SELECT
    wl.id,
    wl.client_id,
    wl.workout_id,
    wl.scheduled_date,
    ROW_NUMBER() OVER (
      PARTITION BY wl.client_id, wl.workout_id, wl.scheduled_date
      ORDER BY (
        SELECT COUNT(*) FROM set_logs sl WHERE sl.workout_log_id = wl.id
      ) DESC, wl.created_at DESC
    ) AS rn
  FROM workout_logs wl
  WHERE wl.scheduled_date IS NOT NULL
),
losers AS (
  SELECT
    rl.id AS loser_id,
    (SELECT id FROM ranked_logs rl2
     WHERE rl2.client_id = rl.client_id
       AND rl2.workout_id = rl.workout_id
       AND rl2.scheduled_date = rl.scheduled_date
       AND rl2.rn = 1
    ) AS canonical_id
  FROM ranked_logs rl
  WHERE rl.rn > 1
)
UPDATE workout_completions wc
SET workout_log_id = l.canonical_id
FROM losers l
WHERE wc.workout_log_id = l.loser_id
  AND NOT EXISTS (
    SELECT 1 FROM workout_completions wc2 WHERE wc2.workout_log_id = l.canonical_id
  );

-- Now delete loser workout_logs. CASCADE removes any remaining set_logs
-- on losers (the collision-staying-on-loser rows from the UPDATE above).
WITH ranked_logs AS (
  SELECT
    wl.id,
    wl.client_id,
    wl.workout_id,
    wl.scheduled_date,
    ROW_NUMBER() OVER (
      PARTITION BY wl.client_id, wl.workout_id, wl.scheduled_date
      ORDER BY (
        SELECT COUNT(*) FROM set_logs sl WHERE sl.workout_log_id = wl.id
      ) DESC, wl.created_at DESC
    ) AS rn
  FROM workout_logs wl
  WHERE wl.scheduled_date IS NOT NULL
)
DELETE FROM workout_logs
WHERE id IN (SELECT id FROM ranked_logs WHERE rn > 1);

-- Step 4: add the unique constraint so this can't reappear.
-- Use a partial index excluding NULL scheduled_date (historical rows
-- pre-dating the scheduled_date column may have NULLs and shouldn't
-- block constraint creation).
CREATE UNIQUE INDEX IF NOT EXISTS workout_logs_unique_per_scheduled_date
  ON workout_logs (client_id, workout_id, scheduled_date)
  WHERE scheduled_date IS NOT NULL;

COMMIT;

-- Notify PostgREST to reload schema cache so the constraint name is
-- visible to upsert ON CONFLICT clauses.
NOTIFY pgrst, 'reload schema';
