-- ============================================================================
-- PENDING — NOT APPLIED. Blocked by the auto-mode safety check on 2026-09-19
-- as a shared-resource change; needs Louis's go-ahead to apply.
-- Apply with the Supabase MCP apply_migration (it is self-verifying and
-- all-or-nothing), then move this file up one directory.
-- ============================================================================
--
-- Perf: flatten RLS on the three hot workout tables.
--
-- Measured as a real client (Chris) on production, 2026-09-19:
--   one-row set save (upsert):  89 ms to plan + 78 ms to run, 1,273-node plan
--   same data, RLS bypassed:     ~3 ms
-- That cost is paid on every set save, many times per workout.
--
-- Cause: set_logs policies look up workout_logs, whose policies look up
-- profiles, whose policies call helper functions. RLS re-applies at every
-- level, and an upsert has to satisfy insert, update AND select policies.
--
-- Fix: replace the chained lookups with SECURITY DEFINER helpers that compute
-- "whose data may this caller see" once per statement without re-entering
-- RLS. Access is unchanged. The trainer rules used to inherit the profiles
-- policy through the nesting, which silently required the client to be in the
-- trainer's own organisation — kept explicitly in staff_visible_client_ids().
--
-- SELF-VERIFYING, all-or-nothing. Before and after, for every real user plus
-- anon: a fingerprint of every visible row in every RLS table (reads), and a
-- real UPDATE, DELETE and INSERT against a row owned by every client in each
-- of the three tables, each rolled back (writes). Any difference in either
-- matrix raises and the whole migration rolls back.

create or replace function pg_temp.rls_snapshot()
returns table(uid text, tbl text, n bigint, h text)
language plpgsql as $fn$
declare u record; t record; cnt bigint; hsh text;
begin
  for u in select p.id::text as id from public.profiles p union all select 'anon' loop
    for t in select c.relname from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
             where ns.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity order by 1 loop
      begin
        if u.id = 'anon' then
          perform set_config('request.jwt.claims', '{"role":"anon"}', true);
          execute 'set local role anon';
        else
          perform set_config('request.jwt.claims', json_build_object('sub', u.id, 'role', 'authenticated')::text, true);
          execute 'set local role authenticated';
        end if;
        execute format('select count(*), coalesce(md5(string_agg(x::text, ''|'' order by x::text)), '''') from public.%I x', t.relname)
          into cnt, hsh;
        execute 'reset role';
      exception when others then
        cnt := -1; hsh := 'ERR:' || sqlstate;
      end;
      uid := u.id; tbl := t.relname; n := cnt; h := hsh;
      return next;
    end loop;
  end loop;
end $fn$;

create or replace function pg_temp.rls_write_matrix()
returns table(uid text, tbl text, target text, op text, outcome text)
language plpgsql as $fn$
declare
  u record; tg record; o text; res text; nrows bigint;
  v_log uuid; v_ex uuid; v_user uuid; v_client uuid; v_workout uuid; v_cp uuid;
begin
  for u in select p.id::text as id from public.profiles p union all select 'anon' loop
    for tg in
      select 'set_logs'::text t, x.id from (
        select distinct on (wl.client_id) sl.id from public.set_logs sl
        join public.workout_logs wl on wl.id = sl.workout_log_id
        order by wl.client_id, sl.id) x
      union all
      select 'workout_logs', x.id from (
        select distinct on (client_id) id from public.workout_logs order by client_id, id) x
      union all
      select 'workout_completions', x.id from (
        select distinct on (client_id) id from public.workout_completions order by client_id, id) x
    loop
      if tg.t = 'set_logs' then
        select workout_log_id, exercise_id, user_id into v_log, v_ex, v_user from public.set_logs where id = tg.id;
      elsif tg.t = 'workout_logs' then
        select client_id, workout_id into v_client, v_workout from public.workout_logs where id = tg.id;
      else
        select client_id, workout_id, client_program_id into v_client, v_workout, v_cp from public.workout_completions where id = tg.id;
      end if;

      foreach o in array array['update','delete','insert'] loop
        res := null;
        begin
          if u.id = 'anon' then
            perform set_config('request.jwt.claims', '{"role":"anon"}', true);
            execute 'set local role anon';
          else
            perform set_config('request.jwt.claims', json_build_object('sub', u.id, 'role', 'authenticated')::text, true);
            execute 'set local role authenticated';
          end if;

          if o = 'update' then
            execute format('update public.%I set id = id where id = $1', tg.t) using tg.id;
            get diagnostics nrows = row_count; res := 'n:' || nrows;
          elsif o = 'delete' then
            execute format('delete from public.%I where id = $1', tg.t) using tg.id;
            get diagnostics nrows = row_count; res := 'n:' || nrows;
          elsif tg.t = 'set_logs' then
            insert into public.set_logs (workout_log_id, exercise_id, set_number, weight_kg, reps_completed, user_id)
            values (v_log, v_ex, 9999, 1, 1, v_user);
            res := 'ins';
          elsif tg.t = 'workout_logs' then
            insert into public.workout_logs (client_id, workout_id, scheduled_date, completed_at)
            values (v_client, v_workout, '2099-12-31', now());
            res := 'ins';
          else
            insert into public.workout_completions (client_id, workout_id, client_program_id, scheduled_date, completed_at)
            values (v_client, v_workout, v_cp, '2099-12-31', now());
            res := 'ins';
          end if;

          raise exception 'probe_rollback';
        exception when others then
          if sqlerrm <> 'probe_rollback' then res := 'E:' || sqlstate; end if;
        end;
        uid := u.id; tbl := tg.t; target := tg.id::text; op := o; outcome := res;
        return next;
      end loop;
    end loop;
  end loop;
end $fn$;

create temp table rls_read_before  on commit drop as select * from pg_temp.rls_snapshot();
create temp table rls_write_before on commit drop as select * from pg_temp.rls_write_matrix();

create or replace function public.staff_visible_client_ids()
returns setof uuid
language sql stable security definer set search_path = public, pg_temp
as $$
  select c.id
  from profiles c
  where c.organization_id = (select v.organization_id from profiles v where v.id = auth.uid())
    and (
      c.trainer_id = auth.uid()
      or (select v.role from profiles v where v.id = auth.uid()) = 'company_admin'
    )
$$;

create or replace function public.own_workout_log_ids()
returns setof uuid
language sql stable security definer set search_path = public, pg_temp
as $$
  select wl.id from workout_logs wl where wl.client_id = auth.uid()
$$;

create or replace function public.staff_visible_workout_log_ids()
returns setof uuid
language sql stable security definer set search_path = public, pg_temp
as $$
  select wl.id from workout_logs wl
  where wl.client_id in (select public.staff_visible_client_ids())
$$;

grant execute on function public.staff_visible_client_ids()      to anon, authenticated, service_role;
grant execute on function public.own_workout_log_ids()           to anon, authenticated, service_role;
grant execute on function public.staff_visible_workout_log_ids() to anon, authenticated, service_role;

drop policy if exists "Clients manage own set_logs"      on public.set_logs;
drop policy if exists "Company admins view org set_logs" on public.set_logs;
drop policy if exists "Super admins view all set_logs"   on public.set_logs;
drop policy if exists "Trainers view client set_logs"    on public.set_logs;

create policy "Clients manage own set_logs" on public.set_logs
  as permissive for all to public
  using      (workout_log_id in (select public.own_workout_log_ids()))
  with check (workout_log_id in (select public.own_workout_log_ids()));

create policy "Staff view client set_logs" on public.set_logs
  as permissive for select to public
  using ((select public.is_super_admin())
         or workout_log_id in (select public.staff_visible_workout_log_ids()));

drop policy if exists "Company admins view org workout_logs" on public.workout_logs;
drop policy if exists "Super admins view all workout_logs"   on public.workout_logs;
drop policy if exists "Trainers view client workout_logs"    on public.workout_logs;

create policy "Staff view client workout_logs" on public.workout_logs
  as permissive for select to public
  using ((select public.is_super_admin())
         or client_id in (select public.staff_visible_client_ids()));

drop policy if exists "Company admins view org completions" on public.workout_completions;
drop policy if exists "Super admins view all completions"   on public.workout_completions;
drop policy if exists "Trainers view client completions"    on public.workout_completions;

create policy "Staff view client completions" on public.workout_completions
  as permissive for select to public
  using ((select public.is_super_admin())
         or client_id in (select public.staff_visible_client_ids()));

create temp table rls_read_after  on commit drop as select * from pg_temp.rls_snapshot();
create temp table rls_write_after on commit drop as select * from pg_temp.rls_write_matrix();

do $$
declare rdiff int; wdiff int; rerr int; nwrite int;
begin
  select count(*) into rdiff from (
    (select * from rls_read_before except select * from rls_read_after)
    union all (select * from rls_read_after except select * from rls_read_before)) d;
  select count(*) into wdiff from (
    (select * from rls_write_before except select * from rls_write_after)
    union all (select * from rls_write_after except select * from rls_write_before)) d;
  select count(*) into rerr from rls_read_after where h like 'ERR:%';
  select count(*) into nwrite from rls_write_after;
  if rdiff > 0 or wdiff > 0 or rerr > 0 then
    raise exception 'RLS behaviour changed — reads: % diffs, writes: % diffs, read errors: % — rolled back', rdiff, wdiff, rerr;
  end if;
  if nwrite < 100 then
    raise exception 'write matrix suspiciously small (%) — rolled back', nwrite;
  end if;
end $$;
