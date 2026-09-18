-- Sèvizi — Admin hierarchy: super admins + exclusive admin accounts
-- Run in Supabase → SQL Editor (idempotent).
--
-- Goal: an account is either a normal user (client/prestataire) OR an admin,
-- never both. Existing admins (profiles.is_admin = true) are grandfathered
-- in as super admins — the only ones who can create new admin accounts, via
-- the admin-create-admin Edge Function (service-role only, so a regular
-- user can never self-promote).
--
-- New admin accounts are created with their own separate login (own
-- auth.users row, own email/password) — never reused from an existing
-- client/prestataire account. Triggers below block an is_admin profile
-- from also becoming a provider or posting a client request, so the
-- exclusivity holds even if someone tries to route around the app UI.

alter table profiles add column if not exists is_super_admin boolean not null default false;
-- Set on a freshly created admin account; forces a password change (set by
-- the super admin as a temporary one) before the admin panel unlocks.
alter table profiles add column if not exists force_password_change boolean not null default false;

-- Grandfather every current admin in as a super admin (one-time backfill —
-- safe to re-run since it's idempotent by construction: it can only ever
-- turn is_super_admin on for rows that are already is_admin).
update profiles set is_super_admin = true where is_admin = true and not is_super_admin;

create or replace function is_super_admin() returns boolean
language sql security definer stable as $$
  select coalesce((select is_super_admin from profiles where id = auth.uid()), false);
$$;

-- ---- Lock is_admin / is_super_admin from self-service updates ----
-- Only a service-role caller (the admin-create-admin / admin-set-role Edge
-- Functions) may change these two columns. A normal authenticated update
-- (e.g. the app's own profile upsert calls) silently keeps the old values
-- instead of erroring, so it never breaks an unrelated "update my name"
-- request that happens to round-trip the whole row.
create or replace function lock_admin_flags() returns trigger
language plpgsql as $$
begin
  if auth.role() is distinct from 'service_role' then
    new.is_admin := old.is_admin;
    new.is_super_admin := old.is_super_admin;
    -- The one self-service exception: a user may clear their OWN
    -- force_password_change flag (after actually changing their password
    -- client-side via supabase.auth.updateUser). They can never set it.
    if new.force_password_change and not old.force_password_change then
      new.force_password_change := old.force_password_change;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lock_admin_flags on profiles;
create trigger trg_lock_admin_flags before update on profiles
  for each row execute function lock_admin_flags();

-- ---- Exclusivity: an admin account can never also be a provider or post
-- client requests ----
create or replace function block_admin_as_provider() returns trigger
language plpgsql as $$
begin
  if exists (select 1 from profiles where id = new.user_id and is_admin) then
    raise exception 'Un compte administrateur ne peut pas être prestataire.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_admin_as_provider on providers;
create trigger trg_block_admin_as_provider before insert or update of user_id on providers
  for each row execute function block_admin_as_provider();

create or replace function block_admin_as_client() returns trigger
language plpgsql as $$
begin
  if new.client_id is not null and exists (select 1 from profiles where id = new.client_id and is_admin) then
    raise exception 'Un compte administrateur ne peut pas publier de demandes.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_admin_as_client on requests;
create trigger trg_block_admin_as_client before insert on requests
  for each row execute function block_admin_as_client();

-- Reading the admin roster (Équipe screen) is covered by the existing
-- "admin reads all profiles" policy (is_admin()) — no extra policy needed.
-- Only super admins get the UI/Edge Function access to actually manage it.
