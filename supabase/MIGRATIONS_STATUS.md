# Migrations status & known drift

_Last reviewed: 2026-08-23 (audit)_

## TL;DR

Production is **healthy** — every constraint, index, and RLS policy the
app relies on exists in the live database. But the `migrations/` folder
does **not** contain a base schema: the first tracked migration
(`20260225_set_logs_unique_constraint.sql`) already assumes ~20 core
tables exist. **A fresh `supabase db reset` / restore from these
migrations alone would fail.**

This is migration drift, not a live bug. The app works. But branch
databases, disaster recovery, and local `supabase start` won't
reconstruct the schema from scratch.

## What was verified present in prod (2026-08-23)

- `workout_completions` UNIQUE (client_id, workout_id, scheduled_date) ✓
  (backs the upsert `onConflict` in /api/workouts/complete)
- `workout_logs` UNIQUE (client_id, workout_id, scheduled_date) partial ✓
- `set_logs` UNIQUE (workout_log_id, exercise_id, set_number) ✓
- `workout_completions.workout_log_id` FK → workout_logs ON DELETE SET NULL ✓
- Hot-path indexes present: idx_workout_logs_client_date,
  idx_client_programs_active, idx_set_logs_workout_log,
  idx_workout_completions_client_date, idx_client_goals_client_id_active ✓
- `set_logs.steps_completed` column ✓ (added 20260823)

## The remaining work (deferred — needs a dedicated effort, ~1 day)

Produce a real baseline migration so fresh restores work:

1. `pg_dump --schema-only --no-owner --no-privileges` from prod
2. Hand-edit into `migrations/00000000_baseline.sql` (strip Supabase-managed
   schemas: auth, storage, realtime, etc. — keep only `public`)
3. Ensure it runs cleanly on an empty DB, then that every subsequent
   dated migration applies on top without error
4. Add the RLS policies + storage bucket definitions (progress-images,
   profile-pictures) which are also untracked

This is intentionally NOT attempted in an incremental PR — a partial
baseline gives false confidence (it would still fail on the first
missing table). It needs to be done in one pass, verified against a
throwaway branch DB.

## Also untracked (lower priority)

- Storage buckets `progress-images`, `profile-pictures` + their policies
  (referenced by 20260506_tighten_storage_select_policies.sql but never
  created in-repo)
- `supabase/add-password-changed.sql` sits OUTSIDE migrations/ as a
  "run manually" script — should be folded into a dated migration
