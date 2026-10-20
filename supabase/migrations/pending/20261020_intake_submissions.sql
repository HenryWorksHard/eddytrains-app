-- Injury intake submissions from the landing page (/custom on cmpdcollective.com).
--
-- NOT YET APPLIED. Run this in the Supabase SQL editor, then set the env vars
-- listed at the bottom. Until it exists, the landing form refuses submissions
-- rather than accepting one it cannot store.
--
-- This table holds health information: date of birth, injury history, prior
-- diagnoses, medication-adjacent answers and three screening questions about
-- neurological and bowel/bladder symptoms. Treat it accordingly. RLS is on and
-- nothing but a trainer-role profile or the service role can read a row.

create table if not exists public.intake_submissions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),

  -- new → contacted → booked → closed. 'spam' is a dead end for junk.
  status      text not null default 'new'
              check (status in ('new','contacted','booked','closed','spam')),

  -- Pulled out of the answers so the list view is one cheap query and so the
  -- common filters (name, email, area) can be indexed. The answers column
  -- below is still the source of truth for every one of them.
  first_name  text,
  last_name   text,
  email       text,
  phone       text,
  areas       text[] not null default '{}',

  -- Which of the three screening questions came back Yes. Empty is the normal
  -- case; anything in here means it is read before it is scheduled.
  red_flags   text[] not null default '{}',

  -- Every answer exactly as submitted, keyed by the field names in
  -- cmpd-landing/app/intake-form.ts. Questions can be added or reworded there
  -- without a migration here.
  answers     jsonb not null,

  -- Eddy's working notes, and who moved it last.
  notes       text,
  handled_by  uuid references auth.users(id) on delete set null,
  handled_at  timestamptz
);

-- The list view is "newest first, optionally filtered by status", and the
-- unread count is "status = 'new'". One index covers both.
create index if not exists intake_submissions_status_created_idx
  on public.intake_submissions (status, created_at desc);

create index if not exists intake_submissions_created_idx
  on public.intake_submissions (created_at desc);

alter table public.intake_submissions enable row level security;

-- Writes come from the API route on the service role key, which bypasses RLS.
-- These policies exist so a trainer-role session can also read and triage
-- directly if a later page queries from the browser. There is deliberately no
-- policy for anon: nothing on the public internet can read this table.
--
-- The predicate is wrapped in a sub-select so Postgres evaluates it once per
-- query as an InitPlan rather than once per row. Unwrapped, that is the
-- difference between ~18ms and ~226ms on the tables already measured here.
--
-- Deliberately checks profiles.role directly rather than calling
-- is_super_admin(): the role list already includes super_admin, and this way
-- the migration depends on no helper function and can be pasted as is.
drop policy if exists "Staff read intake submissions"   on public.intake_submissions;
drop policy if exists "Staff update intake submissions" on public.intake_submissions;

create policy "Staff read intake submissions" on public.intake_submissions
  as permissive for select to authenticated
  using (
    (select exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('trainer','admin','company_admin','super_admin')
    ))
  );

create policy "Staff update intake submissions" on public.intake_submissions
  as permissive for update to authenticated
  using (
    (select exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('trainer','admin','company_admin','super_admin')
    ))
  )
  with check (true);

comment on table public.intake_submissions is
  'Injury intake forms from cmpdcollective.com/custom. Contains health information. Read before scheduling when red_flags is non-empty.';

-- ── After running this ────────────────────────────────────────────────────
--   app.cmpdcollective.com (Vercel):  INTAKE_SECRET = <a long random string>
--   cmpd-landing          (Vercel):  INTAKE_SECRET = <the same string>
--                                    INTAKE_ENDPOINT = https://app.cmpdcollective.com/api/intake
-- The landing site never holds a database key; it posts to the app and the app
-- is the only thing that writes.
