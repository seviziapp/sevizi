-- Sèvizi — Service photos + admin visibility into sales/service activity
-- Run in Supabase → SQL Editor (idempotent).

-- ---- Provider service photos ----
alter table provider_services add column if not exists photo_url text;

-- ---- Admin read access for the activity feed ----
-- job_payments and pro_payments previously only had "the two parties can
-- read their own" policies — no admin bypass, so an admin session couldn't
-- see sales at all. provider_services and appointments already allow admin
-- reads (public select / is_admin() respectively), nothing to add there.
drop policy if exists "admin reads all job payments" on job_payments;
create policy "admin reads all job payments" on job_payments for select using (is_admin());

drop policy if exists "admin reads all pro payments" on pro_payments;
create policy "admin reads all pro payments" on pro_payments for select using (is_admin());
