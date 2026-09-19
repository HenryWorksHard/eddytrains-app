-- Perf 2026-09-19 — APPLIED to production.
--
-- is_super_admin() and get_user_org_id() were VOLATILE and called unwrapped
-- in policies, so Postgres evaluated them once PER ROW. The profiles policies
-- are pulled into nearly every other table's policies, so the cost multiplied
-- through the schema. Measured as a real client reading 415 history rows:
-- 226 ms before, 18 ms after (2.8 ms with RLS bypassed entirely).
--
-- Declared STABLE and wrapped as (select public.fn()) so each is an InitPlan
-- evaluated once per statement. Verified at apply time: row visibility was
-- fingerprinted for every real user plus anon across all 33 RLS tables before
-- and after (561 pairs) and was identical — the migration aborts otherwise.
-- The applied version carried that harness; see
-- pending/20260919_rls_flatten_workout_tables.sql for the same harness.

alter function public.is_super_admin() stable;
alter function public.get_user_org_id() stable;

do $$
declare
  r record; q text; wc text; s text; stmts text[] := '{}';
  unwrap_sa  text := '\(\s*SELECT\s+(public\.)?is_super_admin\(\)(\s+AS\s+\w+)?\s*\)';
  unwrap_org text := '\(\s*SELECT\s+(public\.)?get_user_org_id\(\)(\s+AS\s+\w+)?\s*\)';
begin
  for r in
    select tablename, policyname, permissive, cmd, roles, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual::text,'') ~ 'is_super_admin\(\)|get_user_org_id\(\)'
        or coalesce(with_check::text,'') ~ 'is_super_admin\(\)|get_user_org_id\(\)')
  loop
    q := r.qual::text; wc := r.with_check::text;
    if q is not null then
      q := regexp_replace(q, unwrap_sa, 'is_super_admin()', 'gi');
      q := regexp_replace(q, unwrap_org, 'get_user_org_id()', 'gi');
      q := regexp_replace(q, '(public\.)?is_super_admin\(\)', '(select public.is_super_admin())', 'g');
      q := regexp_replace(q, '(public\.)?get_user_org_id\(\)', '(select public.get_user_org_id())', 'g');
    end if;
    if wc is not null then
      wc := regexp_replace(wc, unwrap_sa, 'is_super_admin()', 'gi');
      wc := regexp_replace(wc, unwrap_org, 'get_user_org_id()', 'gi');
      wc := regexp_replace(wc, '(public\.)?is_super_admin\(\)', '(select public.is_super_admin())', 'g');
      wc := regexp_replace(wc, '(public\.)?get_user_org_id\(\)', '(select public.get_user_org_id())', 'g');
    end if;
    stmts := stmts || format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
    s := format('create policy %I on public.%I as %s for %s to %s',
                r.policyname, r.tablename, r.permissive, r.cmd, array_to_string(r.roles, ', '));
    if q  is not null then s := s || ' using (' || q || ')'; end if;
    if wc is not null then s := s || ' with check (' || wc || ')'; end if;
    stmts := stmts || s;
  end loop;
  foreach s in array stmts loop execute s; end loop;
end $$;
