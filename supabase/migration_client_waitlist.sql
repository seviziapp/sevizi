-- Sèvizi — providers-first launch: close client access until an opening
-- date, with a waitlist. Run in Supabase → SQL Editor (idempotent).
--
-- Until app_config.client_opening_at passes:
--   * new accounts can't act as clients: posting a request and booking an
--     appointment are refused by the database itself (so an old app build or a
--     direct API call can't get around it),
--   * the sign-up screen shows "ouverture le 1er janvier" and a waitlist form,
--   * everyone who already has an account, every test account and every admin
--     keeps working (profiles.client_access, backfilled to true below).
-- After the date, everything opens by itself. Change or clear the date any
-- time (super admin: update app_config) — no app build needed.

create table if not exists app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table app_config enable row level security;
drop policy if exists "anyone reads app config" on app_config;
create policy "anyone reads app config" on app_config for select using (true);
drop policy if exists "super admin writes app config" on app_config;
create policy "super admin writes app config" on app_config for all using (is_super_admin()) with check (is_super_admin());

insert into app_config (key, value) values ('client_opening_at', '"2027-01-01T00:00:00Z"')
  on conflict (key) do nothing;

alter table profiles add column if not exists client_access boolean not null default false;
-- Everyone who exists today keeps the access they have.
update profiles set client_access = true where client_access = false;

-- Same as before, plus: users can't grant themselves client_access.
create or replace function protect_profile_verified() returns trigger
language plpgsql as $$
begin
  if auth.role() = 'authenticated' and not is_admin() then
    if tg_op = 'INSERT' then
      new.verified := false;
      new.is_test := false;
      new.thermal_printer := false;
      new.client_access := false;
    else
      new.verified := old.verified;
      new.is_test := old.is_test;
      new.thermal_printer := old.thermal_printer;
      new.client_access := old.client_access;
    end if;
  end if;
  return new;
end; $$;

create or replace function clients_open() returns boolean
language sql stable security definer as $$
  select coalesce(now() >= (select (value #>> '{}')::timestamptz from app_config where key = 'client_opening_at'), true);
$$;

create or replace function client_access_ok(p_user uuid) returns boolean
language sql stable security definer as $$
  select clients_open() or coalesce(
    (select client_access or coalesce(is_test, false) or coalesce(is_admin, false) from profiles where id = p_user), false);
$$;

-- What the app needs to decide which screen to show. Open to signed-out
-- visitors too (the sign-up screen asks before anyone has an account).
create or replace function client_access_status() returns jsonb
language sql stable security definer as $$
  select jsonb_build_object(
    'open', clients_open(),
    'opens_at', (select value #>> '{}' from app_config where key = 'client_opening_at'),
    'has_access', case when auth.uid() is null then false else client_access_ok(auth.uid()) end);
$$;
grant execute on function client_access_status() to anon, authenticated;

create or replace function enforce_client_access() returns trigger
language plpgsql security definer as $$
declare
  v_at timestamptz := (select (value #>> '{}')::timestamptz from app_config where key = 'client_opening_at');
  v_months text[] := array['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
begin
  if new.client_id is not null and not client_access_ok(new.client_id) then
    raise exception 'Sèvizi ouvre aux clients le % % %. Pour le moment, nous accueillons les prestataires.',
      case when extract(day from v_at) = 1 then '1er' else extract(day from v_at)::int::text end,
      v_months[extract(month from v_at)::int], extract(year from v_at)::int;
  end if;
  return new;
end; $$;
drop trigger if exists trg_enforce_client_access_requests on requests;
create trigger trg_enforce_client_access_requests before insert on requests for each row execute function enforce_client_access();
drop trigger if exists trg_enforce_client_access_appointments on appointments;
create trigger trg_enforce_client_access_appointments before insert on appointments for each row execute function enforce_client_access();

-- ---- waitlist ----
create table if not exists client_waitlist (
  id uuid primary key default gen_random_uuid(),
  phone text,
  email text,
  service text,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (phone is not null or email is not null)
);
create unique index if not exists client_waitlist_phone_key on client_waitlist (phone) where phone is not null;
create unique index if not exists client_waitlist_email_key on client_waitlist (lower(email)) where email is not null;
alter table client_waitlist enable row level security;
drop policy if exists "admin reads waitlist" on client_waitlist;
create policy "admin reads waitlist" on client_waitlist for select using (is_admin());
drop policy if exists "admin deletes waitlist" on client_waitlist;
create policy "admin deletes waitlist" on client_waitlist for delete using (is_admin());
-- No insert policy on purpose: people join only through join_client_waitlist().

create or replace function join_client_waitlist(p_phone text, p_email text, p_service text) returns text
language plpgsql security definer as $$
declare
  -- Digits only, Togo country code (228) dropped, so "+228 90 11 22 33" and "90112233" are the same person.
  v_phone text := nullif(regexp_replace(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '^(00)?228(?=[0-9]{8}$)', ''), '');
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_service text := nullif(left(btrim(coalesce(p_service, '')), 200), '');
begin
  if v_phone is not null and length(v_phone) not between 8 and 15 then
    raise exception 'Numéro de téléphone invalide.';
  end if;
  if v_email is not null and (length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'Adresse e-mail invalide.';
  end if;
  if v_phone is null and v_email is null then
    raise exception 'Indiquez un numéro de téléphone ou une adresse e-mail.';
  end if;
  -- Crude flood guard for an endpoint open to anyone.
  if (select count(*) from client_waitlist where created_at > now() - interval '1 hour') > 300 then
    raise exception 'Trop d''inscriptions en ce moment, réessayez dans un moment.';
  end if;
  if exists (select 1 from client_waitlist where (v_phone is not null and phone = v_phone) or (v_email is not null and lower(email) = v_email)) then
    return 'already';
  end if;
  insert into client_waitlist (phone, email, service, user_id) values (v_phone, v_email, v_service, auth.uid());
  return 'joined';
end; $$;
grant execute on function join_client_waitlist(text, text, text) to anon, authenticated;
