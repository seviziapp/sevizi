-- Sèvizi — lock down verification, disputes, and ID/CFE document storage
-- Run in Supabase → SQL Editor (idempotent).
--
-- Audit findings fixed here:
--  1. verification_requests was readable AND updatable by everyone
--     (using (true)) — any user could approve their own verification.
--  2. disputes was readable and updatable by everyone.
--  3. ID / CFE uploads lived in the PUBLIC 'documents' bucket — anyone with
--     a URL could open them. They now go to a private 'verification-docs'
--     bucket (signed, short-lived URLs for admins only). The public
--     'documents' bucket stays for gallery / service photos / invoice logos,
--     which are meant to be shown to other users.
--  4. protect_provider_tier_columns reverted providers.verified for EVERY
--     authenticated caller, admins included — so approving a verification
--     marked the request approved but never turned the badge on.
--  5. profiles.verified had no protection at all — a client could set their
--     own verified badge.

-- ---- 1) verification_requests ----
drop policy if exists "read verifications" on verification_requests;
drop policy if exists "update verifications" on verification_requests;
drop policy if exists "own or admin reads verifications" on verification_requests;
create policy "own or admin reads verifications" on verification_requests
  for select using (auth.uid() = user_id or is_admin());
drop policy if exists "admin updates verifications" on verification_requests;
create policy "admin updates verifications" on verification_requests
  for update using (is_admin());

-- ---- 2) disputes ----
drop policy if exists "read disputes" on disputes;
drop policy if exists "update disputes" on disputes;
drop policy if exists "reporter or admin reads disputes" on disputes;
create policy "reporter or admin reads disputes" on disputes
  for select using (auth.uid() = reporter_id or is_admin());
drop policy if exists "admin updates disputes" on disputes;
create policy "admin updates disputes" on disputes
  for update using (is_admin());

-- ---- 3) verified flag: only an admin (or service role) may change it ----
create or replace function protect_provider_tier_columns() returns trigger
language plpgsql as $$
begin
  if auth.role() = 'authenticated' then
    if tg_op = 'INSERT' then
      new.tier := 'free';
      new.pro_since := null;
      new.commission_discount_pct := 0;
      new.commission_discount_until := null;
      new.verified := false;
    elsif tg_op = 'UPDATE' then
      new.tier := old.tier;
      new.pro_since := old.pro_since;
      new.commission_discount_pct := old.commission_discount_pct;
      new.commission_discount_until := old.commission_discount_until;
      -- Admin approving a verification is the one legitimate client-side
      -- change to this flag.
      if not is_admin() then
        new.verified := old.verified;
      end if;
    end if;
  end if;
  return new;
end; $$;

create or replace function protect_profile_verified() returns trigger
language plpgsql as $$
begin
  if auth.role() = 'authenticated' and not is_admin() then
    if tg_op = 'INSERT' then
      new.verified := false;
    else
      new.verified := old.verified;
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_protect_profile_verified on profiles;
create trigger trg_protect_profile_verified before insert or update on profiles
  for each row execute function protect_profile_verified();

-- ---- 4) private bucket for ID / CFE documents ----
insert into storage.buckets (id, name, public) values ('verification-docs', 'verification-docs', false)
on conflict (id) do update set public = false;

drop policy if exists "upload verification docs" on storage.objects;
create policy "upload verification docs" on storage.objects
  for insert to authenticated with check (bucket_id = 'verification-docs');

-- Owner (file name starts with "<folder>/<their uid>-") or admin can read.
drop policy if exists "read verification docs" on storage.objects;
create policy "read verification docs" on storage.objects
  for select to authenticated using (
    bucket_id = 'verification-docs'
    and (is_admin() or name like '%/' || auth.uid()::text || '-%')
  );

-- The public bucket must no longer accept ID / CFE uploads (older app
-- builds still upload there; they'll get an upload error until updated
-- rather than silently leaking IDs into a public bucket).
drop policy if exists "upload documents" on storage.objects;
create policy "upload documents" on storage.objects
  for insert with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] not in ('id-docs', 'trade-docs')
  );
