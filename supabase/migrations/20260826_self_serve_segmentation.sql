-- Self-serve segmentation: separate Eddy's coached clients from landing-page
-- program buyers, and his bespoke programs from the sellable rehab catalog.
--
-- Three descriptive flags + one slug. Nothing here changes existing behaviour:
-- every current row backfills to the "coached / custom / assigned" defaults,
-- which is exactly what today's data is.

-- 1. How did this client arrive?
--    'coached'    — invited by a trainer through the app (today's only path)
--    'self_serve' — bought a program on the landing page
alter table public.profiles
  add column if not exists client_type text not null default 'coached';

alter table public.profiles
  drop constraint if exists profiles_client_type_check;
alter table public.profiles
  add constraint profiles_client_type_check
  check (client_type in ('coached', 'self_serve'));

-- 2. What kind of program is this?
--    'custom'  — built by a trainer for specific clients (private)
--    'catalog' — a sellable rehab program offered on the landing page
alter table public.programs
  add column if not exists program_kind text not null default 'custom';

alter table public.programs
  drop constraint if exists programs_program_kind_check;
alter table public.programs
  add constraint programs_program_kind_check
  check (program_kind in ('custom', 'catalog'));

-- 3. Stable slug joining a landing-page program (cmpd-landing/app/programs.ts)
--    to the real template here. Only catalog programs need one.
alter table public.programs
  add column if not exists slug text;

-- Unique per org, not globally — so a future second org can run its own
-- catalog with the same slugs without colliding.
create unique index if not exists programs_org_slug_unique
  on public.programs (organization_id, slug)
  where slug is not null;

-- 4. How did this client get this program?
--    'assigned'  — a trainer gave it to them; the trainer controls access
--    'purchased' — they bought it; end_date is a real licence term
alter table public.client_programs
  add column if not exists source text not null default 'assigned';

alter table public.client_programs
  drop constraint if exists client_programs_source_check;
alter table public.client_programs
  add constraint client_programs_source_check
  check (source in ('assigned', 'purchased'));

-- Roster tab filter: clients of one kind within an org.
create index if not exists profiles_org_client_type_idx
  on public.profiles (organization_id, client_type)
  where role = 'client';

-- Program builder tab filter.
create index if not exists programs_org_kind_idx
  on public.programs (organization_id, program_kind);

-- Entitlement lookups filter on client + source + dates.
create index if not exists client_programs_client_source_idx
  on public.client_programs (client_id, source);

comment on column public.profiles.client_type is
  'How the client arrived: coached (trainer invite) or self_serve (landing-page purchase). Descriptive, not a permission — both are role=client.';
comment on column public.programs.program_kind is
  'custom = trainer-built for specific clients; catalog = sellable rehab program on the landing page.';
comment on column public.programs.slug is
  'Stable key matching a program id in cmpd-landing/app/programs.ts. Catalog programs only.';
comment on column public.client_programs.source is
  'assigned = trainer gave it (trainer controls access, end_date is a planning date); purchased = bought (end_date is an enforced licence term).';
