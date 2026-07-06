-- ============================================================================
-- Sèvizi — ONE-SHOT SETUP
-- Paste this whole file into Supabase → SQL Editor → Run.
-- It is idempotent: safe to run any number of times. Run it after schema.sql.
-- It brings the database fully in sync with the deployed app (all features).
-- ============================================================================


-- ============================================================
-- 1) Signup detail fields + verification (client & provider)
-- ============================================================
alter table profiles add column if not exists first_name text;
alter table profiles add column if not exists last_name  text;
alter table profiles add column if not exists email      text;
alter table profiles add column if not exists verified   boolean default false;
alter table profiles add column if not exists id_doc_url text;
alter table profiles add column if not exists onboarded  boolean default false;
alter table profiles add column if not exists is_admin   boolean default false;  -- admin back-office access

alter table verification_requests alter column provider_id drop not null;
alter table verification_requests add column if not exists user_id      uuid references auth.users(id) on delete cascade;
alter table verification_requests add column if not exists type         text not null default 'provider' check (type in ('client','provider'));
alter table verification_requests add column if not exists display_name text;
alter table verification_requests add column if not exists company_info text;

drop policy if exists "submit own verification" on verification_requests;
create policy "submit own verification" on verification_requests
  for insert with check (auth.uid() = user_id);
drop policy if exists "read verifications" on verification_requests;
create policy "read verifications" on verification_requests for select using (true);
drop policy if exists "update verifications" on verification_requests;
create policy "update verifications" on verification_requests for update using (true);

insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do nothing;

drop policy if exists "upload documents" on storage.objects;
create policy "upload documents" on storage.objects
  for insert to authenticated with check (bucket_id = 'documents');
drop policy if exists "read documents" on storage.objects;
create policy "read documents" on storage.objects
  for select using (bucket_id = 'documents');


-- ============================================================
-- 2) Provider profile: gallery photos + avatar
-- ============================================================
alter table providers add column if not exists gallery    text[] default '{}';
alter table providers add column if not exists avatar_url text;


-- ============================================================
-- 3) Offer acceptance + denormalized client contact on jobs
-- ============================================================
alter table jobs add column if not exists client_name  text;
alter table jobs add column if not exists client_phone text;

drop policy if exists "client accepts offer" on offers;
create policy "client accepts offer" on offers for update
  using (exists (select 1 from requests r where r.id = offers.request_id and r.client_id = auth.uid()));


-- ============================================================
-- 4) Automatic notifications (SECURITY DEFINER triggers)
-- ============================================================
create or replace function notify_new_offer() returns trigger
language plpgsql security definer as $$
declare v_client uuid; v_name text;
begin
  select r.client_id into v_client from requests r where r.id = new.request_id;
  select p.name into v_name from providers p where p.id = new.provider_id;
  if v_client is not null then
    insert into notifications (user_id, type, title, body, action_route)
    values (v_client, 'offer', 'Nouvelle offre reçue',
            coalesce(v_name, 'Un prestataire') || ' a répondu à votre demande — '
              || coalesce(new.price::text, '?') || ' F.',
            '/client/offers?requestId=' || new.request_id::text);
  end if;
  return new;
end; $$;
drop trigger if exists trg_notify_new_offer on offers;
create trigger trg_notify_new_offer after insert on offers
  for each row execute function notify_new_offer();

create or replace function notify_job_created() returns trigger
language plpgsql security definer as $$
declare v_user uuid; v_client_name text;
begin
  select user_id into v_user from providers where id = new.provider_id;
  select full_name into v_client_name from profiles where id = new.client_id;
  if v_user is not null then
    insert into notifications (user_id, type, title, body, action_route)
    values (v_user, 'accepted', 'Offre acceptée 🎉',
            coalesce(v_client_name, 'Un client') || ' a accepté votre offre. Démarrez la mission.',
            '/provider/active-job');
  end if;
  return new;
end; $$;
drop trigger if exists trg_notify_job_created on jobs;
create trigger trg_notify_job_created after insert on jobs
  for each row execute function notify_job_created();

create or replace function notify_job_status() returns trigger
language plpgsql security definer as $$
declare v_label text;
begin
  if new.status = old.status then return new; end if;
  v_label := case new.status
    when 'en_route' then 'Votre prestataire est en route 🚗'
    when 'arrive'   then 'Votre prestataire est arrivé 📍'
    when 'en_cours' then 'La mission a commencé 🔧'
    when 'termine'  then 'Mission terminée 🏁 — laissez un avis !'
    else 'Mise à jour de votre mission' end;
  insert into notifications (user_id, type, title, body, action_route)
  values (new.client_id,
          (case new.status when 'arrive' then 'arrived' when 'termine' then 'completed' else 'accepted' end)::notif_type,
          v_label, '', '/client/job-status');
  -- Close the request once the mission is finished so it leaves "open missions".
  if new.status = 'termine' then
    update requests set status = 'terminee' where id = new.request_id;
  end if;
  return new;
end; $$;
drop trigger if exists trg_notify_job_status on jobs;
create trigger trg_notify_job_status after update on jobs
  for each row execute function notify_job_status();

create or replace function notify_new_message() returns trigger
language plpgsql security definer as $$
declare v_client uuid; v_recipient uuid; v_name text;
begin
  select r.client_id into v_client from requests r where r.id = new.request_id;
  if new.sender_id = v_client then
    select pr.user_id into v_recipient
      from jobs j join providers pr on pr.id = j.provider_id
      where j.request_id = new.request_id order by j.accepted_at desc limit 1;
    if v_recipient is null then
      select pr.user_id into v_recipient
        from offers o join providers pr on pr.id = o.provider_id
        where o.request_id = new.request_id order by o.created_at desc limit 1;
    end if;
  else
    v_recipient := v_client;
  end if;
  if v_recipient is not null and v_recipient <> new.sender_id then
    select coalesce(full_name, 'Quelqu''un') into v_name from profiles where id = new.sender_id;
    insert into notifications (user_id, type, title, body, action_route)
    values (v_recipient, 'system', 'Nouveau message',
            coalesce(v_name, 'Quelqu''un') || ' vous a envoyé un message.',
            '/client/thread?requestId=' || new.request_id::text);
  end if;
  return new;
end; $$;
drop trigger if exists trg_notify_new_message on messages;
create trigger trg_notify_new_message after insert on messages
  for each row execute function notify_new_message();


-- ============================================================
-- 5) Reviews: recompute provider rating + notify + one per job
-- ============================================================
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'reviews_job_unique') then
    alter table reviews add constraint reviews_job_unique unique (job_id);
  end if;
end $$;

create or replace function on_new_review() returns trigger
language plpgsql security definer as $$
declare v_avg numeric; v_count int; v_user uuid;
begin
  select round(avg(rating)::numeric, 1), count(*) into v_avg, v_count
    from reviews where provider_id = new.provider_id;
  update providers set rating = coalesce(v_avg, 0), reviews = coalesce(v_count, 0)
    where id = new.provider_id;
  select user_id into v_user from providers where id = new.provider_id;
  if v_user is not null then
    insert into notifications (user_id, type, title, body, action_route)
    values (v_user, 'review', 'Nouvel avis ⭐',
            coalesce(new.author_name, 'Un client') || ' vous a laissé ' || new.rating || '/5.',
            '/provider/profile');
  end if;
  return new;
end; $$;
drop trigger if exists trg_on_new_review on reviews;
create trigger trg_on_new_review after insert on reviews
  for each row execute function on_new_review();


-- ============================================================
-- 6) Messaging: precise thread access (no cross-account leaks)
-- ============================================================
drop policy if exists "msgs in own thread" on messages;
drop policy if exists "thread parties"    on messages;
create policy "thread parties" on messages for all using (
  sender_id = auth.uid()
  or exists (select 1 from requests r where r.id = messages.request_id and r.client_id = auth.uid())
  or exists (
    select 1 from jobs j join providers p on p.id = j.provider_id
    where j.request_id = messages.request_id and p.user_id = auth.uid()
  )
) with check (sender_id = auth.uid());


-- ============================================================
-- 7) Disputes: parties signal a problem → admin resolves
-- ============================================================
alter table disputes add column if not exists reporter_name text;
alter table disputes add column if not exists reporter_role text;

drop policy if exists "dispute parties" on disputes;
drop policy if exists "report dispute"  on disputes;
drop policy if exists "read disputes"   on disputes;
drop policy if exists "update disputes" on disputes;
create policy "report dispute" on disputes for insert with check (auth.uid() = reporter_id);
create policy "read disputes"  on disputes for select using (true);
create policy "update disputes" on disputes for update using (true);

create or replace function notify_new_dispute() returns trigger
language plpgsql security definer as $$
declare v_client uuid; v_provider_user uuid; v_recipient uuid;
begin
  select j.client_id, pr.user_id into v_client, v_provider_user
    from jobs j join providers pr on pr.id = j.provider_id
    where j.id = new.job_id;
  v_recipient := case when new.reporter_id = v_client then v_provider_user else v_client end;
  if v_recipient is not null and v_recipient <> new.reporter_id then
    insert into notifications (user_id, type, title, body, action_route)
    values (v_recipient, 'system', 'Problème signalé ⚠️',
            'Un problème a été signalé sur votre mission. Le support va intervenir.',
            '/client/job-status');
  end if;
  return new;
end; $$;
drop trigger if exists trg_notify_new_dispute on disputes;
create trigger trg_notify_new_dispute after insert on disputes
  for each row execute function notify_new_dispute();


-- ============================================================
-- 8) Real coordinates for "nearby" matching (maps efficiency)
-- ============================================================
alter table profiles add column if not exists location_lat double precision;
alter table profiles add column if not exists location_lng double precision;


-- ============================================================
-- 9) Keep client/provider contact info off the platform
-- ============================================================
revoke select (client_phone) on jobs from authenticated;

create or replace function redact_contact_info() returns trigger
language plpgsql as $$
begin
  if new.body is null then return new; end if;
  new.body := regexp_replace(
    new.body,
    '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
    '[coordonnées masquées]', 'g'
  );
  new.body := regexp_replace(
    new.body,
    '[0-9][ .()-]{0,2}[0-9][ .()-]{0,2}[0-9][ .()-]{0,2}[0-9][ .()-]{0,2}[0-9][ .()-]{0,2}[0-9][ .()-]{0,2}[0-9]',
    '[coordonnées masquées]', 'g'
  );
  return new;
end; $$;
drop trigger if exists trg_redact_contact_info on messages;
create trigger trg_redact_contact_info before insert on messages
  for each row execute function redact_contact_info();


-- ============================================================
-- 10) Sèvizi Pro: provider subscription tier
-- ============================================================
alter table providers add column if not exists tier text not null default 'free' check (tier in ('free','pro'));
alter table providers add column if not exists categories service_category[] not null default '{}';
alter table providers add column if not exists pro_since timestamptz;

-- Return columns changed (added tier, categories) — Postgres won't let
-- CREATE OR REPLACE change a table function's output shape, so drop first.
drop function if exists nearby_providers(double precision, double precision, service_category, double precision);
create or replace function nearby_providers(
  lat double precision,
  lng double precision,
  cat service_category default null,
  radius_km double precision default 10
)
returns table (
  id uuid, name text, category service_category,
  rating numeric, reviews int, verified boolean, online boolean,
  missions int, years_active int, response_rate int, bio text,
  tier text, categories service_category[],
  lat double precision, lng double precision, distance_km double precision
)
language sql stable as $$
  select p.id, p.name, p.category, p.rating, p.reviews, p.verified, p.online,
         p.missions, p.years_active, p.response_rate, p.bio,
         p.tier, p.categories,
         st_y(p.geo::geometry) as lat,
         st_x(p.geo::geometry) as lng,
         round((st_distance(p.geo, st_setsrid(st_makepoint(lng, lat),4326)::geography)/1000)::numeric, 2) as distance_km
  from providers p
  where p.online
    and (cat is null or p.category = cat or cat = any(p.categories))
    and st_dwithin(p.geo, st_setsrid(st_makepoint(lng, lat),4326)::geography, radius_km*1000)
  order by (p.tier = 'pro') desc, distance_km;
$$;


-- ============================================================
-- 11) PayDunya: real payment for the Sèvizi Pro subscription
-- ============================================================
create table if not exists pro_payments (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references providers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount int not null,
  status text not null default 'pending' check (status in ('pending','completed','failed','cancelled')),
  paydunya_token text unique,
  invoice_url text,
  created_at timestamptz default now(),
  confirmed_at timestamptz
);

alter table pro_payments enable row level security;
drop policy if exists "read own pro payments" on pro_payments;
create policy "read own pro payments" on pro_payments for select using (auth.uid() = user_id);
-- No client insert/update policy: both Edge Functions write via the
-- service-role key, which bypasses RLS entirely.

-- Lock tier/pro_since to service-role writes only — only the PayDunya
-- webhook (service-role) can grant Pro; a provider's own session cannot.
create or replace function protect_provider_tier_columns() returns trigger
language plpgsql as $$
begin
  if auth.role() = 'authenticated' then
    if tg_op = 'INSERT' then
      new.tier := 'free';
      new.pro_since := null;
    elsif tg_op = 'UPDATE' then
      new.tier := old.tier;
      new.pro_since := old.pro_since;
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_protect_provider_tier on providers;
create trigger trg_protect_provider_tier before insert or update on providers
  for each row execute function protect_provider_tier_columns();

-- Done ✅
