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

drop policy if exists "admin reads all profiles" on profiles;
create policy "admin reads all profiles" on profiles for select using (
  exists (select 1 from profiles p2 where p2.id = auth.uid() and p2.is_admin)
);

drop policy if exists "admin reads all jobs" on jobs;
create policy "admin reads all jobs" on jobs for select using (
  exists (select 1 from profiles p2 where p2.id = auth.uid() and p2.is_admin)
);
