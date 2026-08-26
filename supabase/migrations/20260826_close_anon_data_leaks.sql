-- Audit 2026-08-26: three tables/views were readable by anyone holding the
-- publishable anon key, which ships in the client bundle and is public by
-- design. Verified live against the REST endpoint before and after this fix.
--
--   client_weekly_volume     LEAKED REAL CLIENT DATA - 114 rows covering 10
--                            distinct clients (client_id + training volume)
--                            to unauthenticated callers. A SECURITY DEFINER
--                            view bypasses the RLS on its base tables.
--   client_personal_records  same view pattern; empty today, would have
--                            leaked the moment it was populated.
--   email_config             reply-to address readable by anon.
--   email_template_settings  template config readable by anon.
--
-- Neither view is referenced anywhere in the app. Both email tables are only
-- ever read through the service-role client (src/app/lib/email.ts and the
-- /api/admin/email-settings routes), which bypasses RLS - so enabling RLS
-- with no policies locks out anon without touching app behaviour.

-- Views respect the caller's RLS instead of the definer's.
alter view public.client_weekly_volume set (security_invoker = true);
alter view public.client_personal_records set (security_invoker = true);

-- Deny-all by default: RLS on, no policies. Service role still has full access.
alter table public.email_config enable row level security;
alter table public.email_template_settings enable row level security;

-- Pin search_path on the two SECURITY DEFINER helpers. EXECUTE is deliberately
-- left in place: both are used inside the RLS policies on profiles and
-- programs, so authenticated callers must be able to run them, and for an
-- anonymous caller they return null / false respectively - no data to leak.
alter function public.get_user_org_id() set search_path = public, pg_temp;
alter function public.is_super_admin() set search_path = public, pg_temp;
