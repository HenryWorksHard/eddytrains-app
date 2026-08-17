-- Client-side diagnostic events for the workout autosave path.
-- Shipped 2026-08-17 to investigate why ~88% of completed workouts are
-- landing with zero set_logs. Autosave is failing silently somewhere on
-- the client (before hitting Supabase), so server logs show nothing.
-- This table lets the client fire-and-forget events describing what
-- happened during each save cycle so we can see:
--   - How many autosave attempts are being triggered per session
--   - How many succeed vs fail
--   - What errors are being thrown
--   - Whether pending state is populated when saves fire
--
-- Retention: keep raw rows for 30 days, then rotate. Not a permanent audit
-- table — pure diagnostic.

CREATE TABLE IF NOT EXISTS client_diagnostic_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,             -- 'save_attempt' | 'save_success' | 'save_failure' | 'flush_before_complete'
  workout_id UUID,                       -- the workout the user was logging (nullable — some events have no workout context)
  workout_log_id UUID,                   -- resolved log id if any
  scheduled_date DATE,
  n_pending_rows INTEGER,                -- pendingLogsRef.current.size at the moment of the event
  n_rows_saved INTEGER,                  -- for save_success — how many upserted
  error_code TEXT,                       -- Postgres error code if any (23505 etc.)
  error_message TEXT,                    -- Full error message
  context JSONB DEFAULT '{}'::jsonb,     -- Free-form context (browser info, timing, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for the two most common queries:
--   1. Per-user recent activity ("what happened to Halley yesterday")
--   2. Aggregate by event_type over time window ("how many failures today")
CREATE INDEX IF NOT EXISTS idx_client_diagnostic_events_user_time
  ON client_diagnostic_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_diagnostic_events_type_time
  ON client_diagnostic_events (event_type, created_at DESC);

-- RLS — clients can only insert their own events (defense-in-depth even
-- though the API route already asserts identity). Super_admin can read all
-- for diagnosis.
ALTER TABLE client_diagnostic_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own diagnostic events"
  ON client_diagnostic_events
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Super admins view all diagnostic events"
  ON client_diagnostic_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
  );

-- Auto-cleanup — rows older than 30 days get pruned nightly by a cron.
-- (Requires the pg_cron extension. If not available, super_admin can
-- manually TRUNCATE the table periodically.)
-- We skip the cron schedule here to keep this migration minimal; add it
-- via a follow-up if diagnostic data becomes large.

NOTIFY pgrst, 'reload schema';
