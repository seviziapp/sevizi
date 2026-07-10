-- Sèvizi — URGENT FIX: infinite recursion in profiles RLS policy
-- Run this in Supabase → SQL Editor IMMEDIATELY. This is currently broken
-- in production and blocks anything that touches the `profiles` table for
-- ALL users (e.g. completing onboarding), not just admins.
--
-- Root cause: "admin reads all profiles" (added in migration_admin_visibility.sql)
-- checks admin status with `exists (select 1 from profiles where id = auth.uid()
-- and is_admin)` — but that inner select is ITSELF subject to profiles' RLS
-- policies, including this very policy, which recurses forever. The same
-- subquery pattern was also used (safely, since it's on a DIFFERENT table)
-- in withdrawal_requests' policies, but is switched to the same fixed
-- function here for consistency.
--
-- Fix: a SECURITY DEFINER function bypasses RLS internally (runs with the
-- privileges of its owner, not the calling user), so it can check
-- profiles.is_admin without re-triggering profiles' own RLS.

create or replace function is_admin() returns boolean
language sql security definer stable as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

drop policy if exists "admin reads all profiles" on profiles;
create policy "admin reads all profiles" on profiles for select using (is_admin());

drop policy if exists "admin reads all jobs" on jobs;
create policy "admin reads all jobs" on jobs for select using (is_admin());

drop policy if exists "provider reads own withdrawals" on withdrawal_requests;
create policy "provider reads own withdrawals" on withdrawal_requests for select using (
  auth.uid() = user_id or is_admin()
);

drop policy if exists "admin resolves withdrawal" on withdrawal_requests;
create policy "admin resolves withdrawal" on withdrawal_requests for update using (is_admin());
