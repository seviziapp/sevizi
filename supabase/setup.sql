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


-- ============================================================
-- 12) PayDunya: real client -> provider job payments
-- ============================================================
alter type payment_method add value if not exists 'paydunya';

alter table jobs add column if not exists payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed'));

create table if not exists job_payments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  provider_id uuid not null references providers(id) on delete cascade,
  amount int not null,
  commission int not null,
  net_amount int not null,
  status text not null default 'pending' check (status in ('pending','completed','failed','cancelled')),
  paydunya_token text unique,
  invoice_url text,
  created_at timestamptz default now(),
  confirmed_at timestamptz
);

alter table job_payments enable row level security;
drop policy if exists "job payment parties" on job_payments;
create policy "job payment parties" on job_payments for select using (
  auth.uid() = client_id
  or auth.uid() = (select user_id from providers where id = job_payments.provider_id)
);

create or replace function protect_job_payment_status() returns trigger
language plpgsql as $$
begin
  if auth.role() = 'authenticated' then
    new.payment_status := old.payment_status;
  end if;
  return new;
end; $$;

drop trigger if exists trg_protect_job_payment_status on jobs;
create trigger trg_protect_job_payment_status before update on jobs
  for each row execute function protect_job_payment_status();


-- ============================================================
-- 13) Provider wallet + manual withdrawal requests
-- ============================================================
-- Admin check as a SECURITY DEFINER function — bypasses RLS internally, so
-- policies that call it don't recurse into profiles' own RLS (an inline
-- `exists (select 1 from profiles where ...)` subquery on a profiles policy
-- would recurse into itself forever; on other tables like this one it's
-- safe either way, but this is used consistently everywhere below).
create or replace function is_admin() returns boolean
language sql security definer stable as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

create table if not exists withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references providers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount int not null check (amount > 0),
  method text not null check (method in ('flooz','mixx')),
  phone text not null,
  status text not null default 'pending' check (status in ('pending','sent','rejected')),
  requested_at timestamptz default now(),
  resolved_at timestamptz,
  admin_note text
);

create or replace function provider_wallet_balance(p_provider_id uuid) returns int
language sql stable as $$
  select coalesce((
    select sum(net_amount) from job_payments
    where provider_id = p_provider_id and status = 'completed'
  ), 0) - coalesce((
    select sum(amount) from withdrawal_requests
    where provider_id = p_provider_id and status in ('pending','sent')
  ), 0);
$$;

create or replace function validate_withdrawal_request() returns trigger
language plpgsql as $$
declare v_balance int;
begin
  v_balance := provider_wallet_balance(new.provider_id);
  if new.amount > v_balance then
    raise exception 'Solde insuffisant pour ce retrait (solde disponible : % F).', v_balance;
  end if;
  return new;
end; $$;

drop trigger if exists trg_validate_withdrawal_request on withdrawal_requests;
create trigger trg_validate_withdrawal_request before insert on withdrawal_requests
  for each row execute function validate_withdrawal_request();

alter table withdrawal_requests enable row level security;

drop policy if exists "provider reads own withdrawals" on withdrawal_requests;
create policy "provider reads own withdrawals" on withdrawal_requests for select using (
  auth.uid() = user_id or is_admin()
);

drop policy if exists "provider requests withdrawal" on withdrawal_requests;
create policy "provider requests withdrawal" on withdrawal_requests for insert with check (auth.uid() = user_id);

drop policy if exists "admin resolves withdrawal" on withdrawal_requests;
create policy "admin resolves withdrawal" on withdrawal_requests for update using (is_admin());

create or replace function notify_withdrawal_sent() returns trigger
language plpgsql security definer as $$
begin
  if new.status = 'sent' and old.status is distinct from 'sent' then
    insert into notifications (user_id, type, title, body, action_route)
    values (new.user_id, 'system', 'Retrait envoyé 💸',
            'Votre retrait de ' || new.amount || ' F a été envoyé.',
            '/provider/withdraw');
  end if;
  return new;
end; $$;
drop trigger if exists trg_notify_withdrawal_sent on withdrawal_requests;
create trigger trg_notify_withdrawal_sent after update on withdrawal_requests
  for each row execute function notify_withdrawal_sent();


-- ============================================================
-- 14) Let admins actually see all users/jobs
-- ============================================================
drop policy if exists "admin reads all profiles" on profiles;
create policy "admin reads all profiles" on profiles for select using (is_admin());

drop policy if exists "admin reads all jobs" on jobs;
create policy "admin reads all jobs" on jobs for select using (is_admin());


-- ============================================================
-- 15) Self-service account deletion — protect financial ledger
-- ============================================================
-- See migration_account_deletion.sql for the full explanation. Deleting a
-- user cascades through most tables; these specific foreign keys are
-- switched from CASCADE to SET NULL so a job's payment/earnings record
-- survives even if the client or provider on it later deletes their account.
alter table requests drop constraint if exists requests_client_id_fkey;
alter table requests alter column client_id drop not null;
alter table requests add constraint requests_client_id_fkey
  foreign key (client_id) references auth.users(id) on delete set null;

alter table offers drop constraint if exists offers_provider_id_fkey;
alter table offers alter column provider_id drop not null;
alter table offers add constraint offers_provider_id_fkey
  foreign key (provider_id) references providers(id) on delete set null;

alter table jobs drop constraint if exists jobs_request_id_fkey;
alter table jobs alter column request_id drop not null;
alter table jobs add constraint jobs_request_id_fkey
  foreign key (request_id) references requests(id) on delete set null;

alter table jobs drop constraint if exists jobs_offer_id_fkey;
alter table jobs alter column offer_id drop not null;
alter table jobs add constraint jobs_offer_id_fkey
  foreign key (offer_id) references offers(id) on delete set null;

alter table jobs drop constraint if exists jobs_provider_id_fkey;
alter table jobs alter column provider_id drop not null;
alter table jobs add constraint jobs_provider_id_fkey
  foreign key (provider_id) references providers(id) on delete set null;

alter table jobs drop constraint if exists jobs_client_id_fkey;
alter table jobs alter column client_id drop not null;
alter table jobs add constraint jobs_client_id_fkey
  foreign key (client_id) references auth.users(id) on delete set null;

alter table job_payments drop constraint if exists job_payments_client_id_fkey;
alter table job_payments alter column client_id drop not null;
alter table job_payments add constraint job_payments_client_id_fkey
  foreign key (client_id) references auth.users(id) on delete set null;

alter table job_payments drop constraint if exists job_payments_provider_id_fkey;
alter table job_payments alter column provider_id drop not null;
alter table job_payments add constraint job_payments_provider_id_fkey
  foreign key (provider_id) references providers(id) on delete set null;

alter table pro_payments drop constraint if exists pro_payments_provider_id_fkey;
alter table pro_payments alter column provider_id drop not null;
alter table pro_payments add constraint pro_payments_provider_id_fkey
  foreign key (provider_id) references providers(id) on delete set null;

alter table pro_payments drop constraint if exists pro_payments_user_id_fkey;
alter table pro_payments alter column user_id drop not null;
alter table pro_payments add constraint pro_payments_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

alter table withdrawal_requests drop constraint if exists withdrawal_requests_provider_id_fkey;
alter table withdrawal_requests alter column provider_id drop not null;
alter table withdrawal_requests add constraint withdrawal_requests_provider_id_fkey
  foreign key (provider_id) references providers(id) on delete set null;

alter table withdrawal_requests drop constraint if exists withdrawal_requests_user_id_fkey;
alter table withdrawal_requests alter column user_id drop not null;
alter table withdrawal_requests add constraint withdrawal_requests_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

alter table reviews drop constraint if exists reviews_author_id_fkey;
alter table reviews alter column author_id drop not null;
alter table reviews add constraint reviews_author_id_fkey
  foreign key (author_id) references auth.users(id) on delete set null;

alter table disputes drop constraint if exists disputes_reporter_id_fkey;
alter table disputes alter column reporter_id drop not null;
alter table disputes add constraint disputes_reporter_id_fkey
  foreign key (reporter_id) references auth.users(id) on delete set null;


-- ============================================================
-- 16) New service categories
-- ============================================================
-- jardinage/demenagement/securite/photographe were already shown as
-- browsable tiles on the client "Toutes les catégories" screen but were
-- never real category values — tapping them silently fell back to
-- "plomberie" on the request form. Promoting them to real categories here
-- fixes that, alongside the newly requested services.
alter type service_category add value if not exists 'jardinage';
alter type service_category add value if not exists 'demenagement';
alter type service_category add value if not exists 'securite';
alter type service_category add value if not exists 'photographe';
alter type service_category add value if not exists 'ferrailleur';
alter type service_category add value if not exists 'macon';
alter type service_category add value if not exists 'soudeur';
alter type service_category add value if not exists 'alu';
alter type service_category add value if not exists 'serigraphie';
alter type service_category add value if not exists 'coursier';
alter type service_category add value if not exists 'tapissier';
alter type service_category add value if not exists 'cordonnier';
alter type service_category add value if not exists 'onglerie';
alter type service_category add value if not exists 'impression';

-- Done ✅
