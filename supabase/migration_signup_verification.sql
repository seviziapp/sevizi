-- Sèvizi — Signup details + verification flow migration
-- Run this in the Supabase SQL editor (safe to run once; uses IF NOT EXISTS).

-- ============================================================
-- 1. Profiles: signup detail fields + client verification flag
-- ============================================================
alter table profiles add column if not exists first_name text;
alter table profiles add column if not exists last_name  text;
alter table profiles add column if not exists email      text;
alter table profiles add column if not exists verified   boolean default false;  -- client ID verification
alter table profiles add column if not exists id_doc_url text;
alter table profiles add column if not exists onboarded  boolean default false;   -- finished detail form

-- ============================================================
-- 2. Verification requests: support BOTH client and provider
--    (table previously only referenced provider_id)
-- ============================================================
alter table verification_requests alter column provider_id drop not null;
alter table verification_requests add column if not exists user_id      uuid references auth.users(id) on delete cascade;
alter table verification_requests add column if not exists type         text not null default 'provider' check (type in ('client','provider'));
alter table verification_requests add column if not exists display_name text;     -- company name (provider) or full name (client)
alter table verification_requests add column if not exists company_info text;     -- registration no., address, etc.

-- ============================================================
-- 3. RLS policies for verification_requests
--    (RLS was enabled but NO policies existed -> table was unusable)
-- ============================================================
drop policy if exists "submit own verification" on verification_requests;
create policy "submit own verification" on verification_requests
  for insert with check (auth.uid() = user_id);

drop policy if exists "read verifications" on verification_requests;
create policy "read verifications" on verification_requests
  for select using (true);   -- admin back-office needs to read the queue

drop policy if exists "update verifications" on verification_requests;
create policy "update verifications" on verification_requests
  for update using (true);   -- admin approves/rejects

-- ============================================================
-- 4. Storage bucket for uploaded documents (ID / licenses)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do nothing;

drop policy if exists "upload documents" on storage.objects;
create policy "upload documents" on storage.objects
  for insert to authenticated with check (bucket_id = 'documents');

drop policy if exists "read documents" on storage.objects;
create policy "read documents" on storage.objects
  for select using (bucket_id = 'documents');
