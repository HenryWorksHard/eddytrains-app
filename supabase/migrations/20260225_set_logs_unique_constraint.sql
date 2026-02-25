-- Add unique constraint to prevent duplicate set entries
-- This ensures only one log per (workout_log, exercise, set_number) combination

-- First, clean up any existing duplicates (keep the most recent)
WITH duplicates AS (
  SELECT id, 
         ROW_NUMBER() OVER (
           PARTITION BY workout_log_id, exercise_id, set_number 
           ORDER BY id DESC
         ) as rn
  FROM set_logs
)
DELETE FROM set_logs 
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Now add the unique constraint
ALTER TABLE set_logs
ADD CONSTRAINT set_logs_unique_entry 
UNIQUE (workout_log_id, exercise_id, set_number);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_set_logs_workout_log 
ON set_logs(workout_log_id);

-- Add index for workout_logs lookups
CREATE INDEX IF NOT EXISTS idx_workout_logs_client_workout_date 
ON workout_logs(client_id, workout_id, scheduled_date DESC);

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
