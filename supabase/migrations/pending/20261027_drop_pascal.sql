-- Removes what is left of Pascal from the database.
--
-- NOT YET APPLIED, and deliberately separate from the code change. The app no
-- longer reads or writes any of this, so it is already dead weight — but
-- dropping a column is a one-way door and the code shipping first means there
-- is a window to change your mind with nothing broken either way.
--
-- Run it in the Supabase SQL editor whenever you are ready. Nothing breaks if
-- you never run it; nothing breaks if you run it today.

-- The score cache that was written on every dashboard load and never once read
-- back. Adherence is recomputed from workout_completions on request now.
drop table if exists public.pascal_scores;

-- Mascot customisation. Nothing has read these since the character went.
alter table public.profiles
  drop column if exists pascal_name,
  drop column if exists pascal_color,
  drop column if exists pascal_skin,
  drop column if exists pascal_outfit,
  drop column if exists pascal_character;

-- The idempotency flag for the old scoring pass. Scoring is stateless now, so
-- there is nothing to mark as counted.
alter table public.workout_completions
  drop column if exists pascal_counted;
