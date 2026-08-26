-- Audit fix (2026-08-23): the client_goals INSERT policy only checked
-- client_id = auth.uid() but left created_by unconstrained, so a client
-- could insert a goal attributed to their trainer (created_by = trainer
-- uid). Tighten so created_by is either null or the client themselves.
-- Trainers create client goals server-side via the admin client, which
-- bypasses RLS, so this doesn't affect the trainer-authored path.
--
-- Already applied to prod via the Supabase MCP; this file tracks it.

DROP POLICY IF EXISTS "Clients can insert own goals" ON client_goals;
CREATE POLICY "Clients can insert own goals"
  ON client_goals FOR INSERT
  WITH CHECK (
    client_id = auth.uid()
    AND (created_by IS NULL OR created_by = auth.uid())
  );
