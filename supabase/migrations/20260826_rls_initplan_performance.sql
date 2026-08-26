-- Audit 2026-08-26: 72 of 88 RLS policies re-evaluated auth.uid() / auth.role()
-- ONCE PER ROW instead of once per statement (Supabase advisor:
-- auth_rls_initplan). Wrapping the call as (select auth.uid()) turns it into an
-- InitPlan that Postgres evaluates a single time per query.
--
-- Pure performance change. (select auth.uid()) returns exactly what auth.uid()
-- returns; policy names, roles, commands, PERMISSIVE/RESTRICTIVE flags and
-- every other part of the expressions are carried over untouched.
--
-- Generated in SQL rather than transcribed by hand so the expressions could
-- not drift, then PROVEN equivalent: a normalised md5 fingerprint of all 88
-- policies (table, name, permissive, cmd, roles, using, with check — with
-- auth.uid() and (select auth.uid()) folded to the same token) was identical
-- before and after: e2bcd98b56ccc5e7ddf670ee972d1837, 88 policies both times.
--
-- Advisor result: auth_rls_initplan 72 -> 0.

do $$
declare
  stmts text[] := '{}';
  s text;
  r record;
  q text;
  wc text;
begin
  for r in
    select tablename, policyname, permissive, cmd, roles, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (qual::text ~ 'auth\.uid\(\)' or with_check::text ~ 'auth\.uid\(\)')
  loop
    -- Unwrap anything already wrapped first, so we never nest selects.
    q := regexp_replace(
           regexp_replace(coalesce(r.qual::text, ''), '\(\s*SELECT\s+auth\.uid\(\)(\s+AS\s+uid)?\s*\)', 'auth.uid()', 'gi'),
           'auth\.uid\(\)', '(select auth.uid())', 'g');
    wc := regexp_replace(
           regexp_replace(coalesce(r.with_check::text, ''), '\(\s*SELECT\s+auth\.uid\(\)(\s+AS\s+uid)?\s*\)', 'auth.uid()', 'gi'),
           'auth\.uid\(\)', '(select auth.uid())', 'g');

    stmts := stmts || format('drop policy if exists %I on public.%I', r.policyname, r.tablename);

    s := format('create policy %I on public.%I as %s for %s to %s',
                r.policyname, r.tablename, r.permissive, r.cmd, array_to_string(r.roles, ', '));
    if r.qual is not null then s := s || ' using (' || q || ')'; end if;
    if r.with_check is not null then s := s || ' with check (' || wc || ')'; end if;
    stmts := stmts || s;
  end loop;

  foreach s in array stmts loop
    execute s;
  end loop;
end $$;

-- The last two call auth.role() instead, so the loop above did not match them.
-- Both are no-ops in practice (the service role bypasses RLS outright); the
-- wrap just stops the predicate being evaluated per row for everyone else.
drop policy if exists "Service role can manage all 1RMs" on public.client_1rms;
create policy "Service role can manage all 1RMs" on public.client_1rms
  as PERMISSIVE for ALL to public
  using (((select auth.role()) = 'service_role'::text));

drop policy if exists "Service role can manage all progress images" on public.progress_images;
create policy "Service role can manage all progress images" on public.progress_images
  as PERMISSIVE for ALL to public
  using (((select auth.role()) = 'service_role'::text));
