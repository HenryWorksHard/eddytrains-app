-- Client-set or trainer-set fitness goals with optional target + deadline.

CREATE TABLE IF NOT EXISTS client_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('lift','workouts','body_weight','custom')),
  metric TEXT,
  target_value NUMERIC,
  current_value NUMERIC DEFAULT 0,
  target_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  achieved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_goals_client_id_active
  ON client_goals(client_id)
  WHERE is_active = true AND achieved_at IS NULL;

ALTER TABLE client_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can read own goals"
  ON client_goals FOR SELECT USING (client_id = auth.uid());
CREATE POLICY "Clients can insert own goals"
  ON client_goals FOR INSERT WITH CHECK (client_id = auth.uid());
CREATE POLICY "Clients can update own goals"
  ON client_goals FOR UPDATE USING (client_id = auth.uid()) WITH CHECK (client_id = auth.uid());
CREATE POLICY "Clients can delete own goals"
  ON client_goals FOR DELETE USING (client_id = auth.uid());
