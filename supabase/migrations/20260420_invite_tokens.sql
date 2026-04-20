-- Invite tokens for client onboarding
-- Replaces the plaintext temp_password flow — clients click a link and set their own password.

CREATE TABLE IF NOT EXISTS invite_tokens (
  token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookup of active (unused, unexpired) tokens per user — for "resend invite" flow
CREATE INDEX IF NOT EXISTS idx_invite_tokens_user_id_active
  ON invite_tokens(user_id)
  WHERE used_at IS NULL;

-- RLS: only service role reads/writes. No client-side access ever.
ALTER TABLE invite_tokens ENABLE ROW LEVEL SECURITY;
-- No policies defined = only service role can access. Good.

COMMENT ON TABLE invite_tokens IS
  'Single-use tokens for client onboarding. Created when trainer adds a client, consumed when client sets their password.';
