-- Sèvizi — flag automated/test accounts so they stop polluting the marketplace
-- Run in Supabase → SQL Editor (idempotent).
--
-- Every Android release submitted to the Play Store triggers Google's
-- pre-launch report, which logs into the app with the test credentials and
-- taps through everything: it posted "urgent" requests (always the same
-- description and phone number) in a burst after each build, and the same
-- account is also a Pro "Test Company" provider that sends offers. Those
-- landed in the admin open-requests queue, in providers' request feeds and
-- in clients' provider search.
--
-- profiles.is_test marks such an account. It is set by an admin/service role
-- only (never by the user — otherwise a spammer could flag themselves to hide
-- from the admin queue). The account keeps working normally for the tester;
-- its requests and provider listing are just invisible to real users.

alter table profiles add column if not exists is_test boolean not null default false;

-- Never client-settable: reset on insert and update unless admin/service role.
create or replace function protect_profile_verified() returns trigger
language plpgsql as $$
begin
  if auth.role() = 'authenticated' and not is_admin() then
    if tg_op = 'INSERT' then
      new.verified := false;
      new.is_test := false;
    else
      new.verified := old.verified;
      new.is_test := old.is_test;
    end if;
  end if;
  return new;
end; $$;

-- SECURITY DEFINER so any signed-in user's query can ask this without being
-- allowed to read other people's profile rows.
create or replace function is_test_account(p_user_id uuid) returns boolean
language sql security definer stable as $$
  select coalesce((select is_test from profiles where id = p_user_id), false);
$$;

-- Providers browse open requests: hide test accounts' requests from them.
-- (Owner, admins, and providers who already have an offer/job are unchanged.)
drop policy if exists "requests visible to parties" on requests;
create policy "requests visible to parties" on requests for select using (
  auth.uid() = client_id
  or is_admin()
  or (status = 'ouverte'
      and not is_test_account(client_id)
      and exists (select 1 from providers p where p.user_id = auth.uid()))
  or exists (
    select 1 from offers o join providers p on p.id = o.provider_id
    where o.request_id = requests.id and p.user_id = auth.uid()
  )
  or exists (
    select 1 from jobs j join providers p on p.id = j.provider_id
    where j.request_id = requests.id and p.user_id = auth.uid()
  )
);

-- Clients searching for providers: hide test accounts' provider listings.
create or replace function nearby_providers(
  lat double precision, lng double precision,
  cat service_category default null, radius_km double precision default 10
) returns table(id uuid, name text, category service_category, rating numeric, reviews integer,
  verified boolean, online boolean, missions integer, years_active integer, response_rate integer,
  bio text, tier text, categories service_category[], lat double precision, lng double precision,
  distance_km double precision)
language sql stable as $$
  select p.id, p.name, p.category, p.rating, p.reviews, p.verified, p.online,
         p.missions, p.years_active, p.response_rate, p.bio,
         p.tier, p.categories,
         st_y(p.geo::geometry) as lat,
         st_x(p.geo::geometry) as lng,
         round((st_distance(p.geo, st_setsrid(st_makepoint(lng, lat),4326)::geography)/1000)::numeric, 2) as distance_km
  from providers p
  where p.online
    and not is_test_account(p.user_id)
    and (cat is null or p.category = cat or cat = any(p.categories))
    and st_dwithin(p.geo, st_setsrid(st_makepoint(lng, lat),4326)::geography, radius_km*1000)
  order by (p.tier = 'pro') desc, distance_km;
$$;
