-- Sèvizi — Let admins actually see all users/jobs
-- Run in Supabase → SQL Editor (idempotent).
--
-- profiles' only RLS policy is "own profile" (auth.uid() = id), so the
-- admin Users screen (a plain select on profiles) silently only ever
-- returned the logged-in admin's own row — never actually broken by a
-- missing feature, just missing a policy. Same root cause undercounts
-- totalUsers/completedToday in the admin dashboard stats. This adds
-- read-only "admin sees everything" policies without touching the
-- existing per-user policies (Postgres OR's permissive policies together).
--
-- SUPERSEDES an earlier version of this file that checked admin status with
-- an inline `exists (select 1 from profiles where ...)` subquery directly in
-- a profiles policy — that recurses into profiles' own RLS (including this
-- very policy) forever. Fixed by wrapping the check in a SECURITY DEFINER
-- function, which bypasses RLS internally. See migration_fix_admin_recursion.sql.

create or replace function is_admin() returns boolean
language sql security definer stable as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

drop policy if exists "admin reads all profiles" on profiles;
create policy "admin reads all profiles" on profiles for select using (is_admin());

drop policy if exists "admin reads all jobs" on jobs;
create policy "admin reads all jobs" on jobs for select using (is_admin());
