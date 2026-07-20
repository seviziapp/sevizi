-- Sèvizi — Supabase schema
-- Run in the Supabase SQL editor. Requires the postgis extension.

create extension if not exists postgis;

-- ---- Enums ----
create type service_category as enum (
  'plomberie','electricite','peinture','menuiserie',
  'coiffure','mecanique','couture','menage',
  'cuisine','transport','reparation','cours',
  'jardinage','demenagement','securite','photographe',
  'ferrailleur','macon','soudeur','alu','serigraphie',
  'coursier','tapissier','cordonnier','onglerie','impression','esthetique'
);
create type request_status as enum ('ouverte','en_cours','terminee','annulee');
create type user_role as enum ('client','prestataire');
create type job_status as enum ('accepte','en_route','arrive','en_cours','termine');
create type payment_method as enum ('cash','flooz','mixx','paydunya');
create type notif_type as enum ('offer','accepted','arrived','completed','review','system');

-- ---- Profiles (extends auth.users) ----
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  first_name text,
  last_name text,
  email text,
  phone text,
  role user_role not null default 'client',
  verified boolean default false,   -- client ID verification
  id_doc_url text,
  onboarded boolean default false,  -- finished the signup detail form
  location_label text,
  location_geo geography(point, 4326),
  created_at timestamptz default now()
);

-- ---- Providers ----
create table providers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  category service_category not null,
  bio text,
  rating numeric(2,1) default 0,
  reviews int default 0,
  missions int default 0,
  years_active int default 0,
  response_rate int default 0,
  verified boolean default false,
  online boolean default false,
  geo geography(point, 4326) not null,
  created_at timestamptz default now(),
  tier text not null default 'free' check (tier in ('free','pro')),  -- Sèvizi Pro subscription
  categories service_category[] not null default '{}',              -- extra services (Pro only)
  pro_since timestamptz
);
create index providers_geo_idx on providers using gist (geo);

-- ---- Requests ----
create table requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references auth.users(id) on delete set null,
  description text not null,
  category service_category not null,
  urgent boolean default false,
  geo geography(point, 4326) not null,
  location_label text,
  status request_status not null default 'ouverte',
  photo_url text,
  created_at timestamptz default now()
);
create index requests_geo_idx on requests using gist (geo);

-- ---- Offers ----
create table offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  provider_id uuid references providers(id) on delete set null,
  price int not null,            -- FCFA
  availability text,
  message text,
  accepted boolean default false,
  created_at timestamptz default now()
);
create index offers_request_idx on offers(request_id);

-- ---- Jobs (active missions) ----
create table jobs (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid references offers(id) on delete set null,
  request_id uuid references requests(id) on delete set null,
  provider_id uuid references providers(id) on delete set null,
  client_id uuid references auth.users(id) on delete set null,
  price int not null,
  payment_method payment_method default 'cash',
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed')),
  status job_status not null default 'accepte',
  accepted_at timestamptz default now(),
  completed_at timestamptz
);
create index jobs_provider_idx on jobs(provider_id);
create index jobs_client_idx on jobs(client_id);

-- ---- Job payments (PayDunya) ----
create table job_payments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  client_id uuid references auth.users(id) on delete set null,
  provider_id uuid references providers(id) on delete set null,
  amount int not null,
  commission int not null,
  net_amount int not null,
  status text not null default 'pending' check (status in ('pending','completed','failed','cancelled')),
  paydunya_token text unique,
  invoice_url text,
  created_at timestamptz default now(),
  confirmed_at timestamptz
);

-- ---- Provider wallet withdrawal requests (manual payout) ----
create table withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references providers(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
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

create trigger trg_validate_withdrawal_request before insert on withdrawal_requests
  for each row execute function validate_withdrawal_request();

-- ---- Messages ----
create table messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text,
  geo geography(point, 4326),    -- optional shared location
  created_at timestamptz default now()
);
create index messages_request_idx on messages(request_id);

-- ---- Reviews ----
create table reviews (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  provider_id uuid not null references providers(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  author_name text not null,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now()
);
create index reviews_provider_idx on reviews(provider_id);

-- ---- Favorites ----
create table favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_id uuid not null references providers(id) on delete cascade,
  created_at timestamptz default now(),
  unique (user_id, provider_id)
);

-- ---- Notifications ----
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type notif_type not null default 'system',
  title text not null,
  body text not null,
  action_route text,
  read boolean default false,
  created_at timestamptz default now()
);
create index notifs_user_idx on notifications(user_id);

-- ---- Verification requests ----
create table verification_requests (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references providers(id) on delete cascade,   -- null for client requests
  user_id uuid references auth.users(id) on delete cascade,
  type text not null default 'provider' check (type in ('client','provider')),
  display_name text,            -- company name (provider) or full name (client)
  company_info text,            -- registration no., address, etc. (provider)
  id_doc_url text,
  trade_doc_url text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

-- ---- Disputes ----
create table disputes (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  reporter_id uuid references auth.users(id) on delete set null,
  reason text not null,
  status text not null default 'ouvert' check (status in ('ouvert','resolu')),
  resolved_at timestamptz,
  created_at timestamptz default now()
);

-- ---- Nearby providers RPC (returns distance in km) ----
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
  -- Priority placement is a Pro perk: Pro providers rank first, then by distance.
  order by (p.tier = 'pro') desc, distance_km;
$$;

-- ---- Nearby requests RPC ----
create or replace function nearby_requests(
  lat double precision,
  lng double precision,
  cat service_category default null,
  radius_km double precision default 10
)
returns table (
  id uuid, description text, category service_category, urgent boolean,
  location_label text, status request_status, offers_count bigint,
  lat double precision, lng double precision, distance_km double precision, created_at timestamptz
)
language sql stable as $$
  select r.id, r.description, r.category, r.urgent, r.location_label, r.status,
         (select count(*) from offers o where o.request_id = r.id) as offers_count,
         st_y(r.geo::geometry) as lat,
         st_x(r.geo::geometry) as lng,
         round((st_distance(r.geo, st_setsrid(st_makepoint(lng, lat),4326)::geography)/1000)::numeric, 2) as distance_km,
         r.created_at
  from requests r
  where r.status = 'ouverte'
    and (cat is null or r.category = cat)
    and st_dwithin(r.geo, st_setsrid(st_makepoint(lng, lat),4326)::geography, radius_km*1000)
  order by distance_km;
$$;

-- ---- Row Level Security ----
alter table profiles             enable row level security;
alter table providers            enable row level security;
alter table requests             enable row level security;
alter table offers               enable row level security;
alter table jobs                 enable row level security;
alter table messages             enable row level security;
alter table reviews              enable row level security;
alter table favorites            enable row level security;
alter table notifications        enable row level security;
alter table verification_requests enable row level security;
alter table disputes             enable row level security;
alter table job_payments         enable row level security;
alter table withdrawal_requests  enable row level security;

-- Admin check as a SECURITY DEFINER function — bypasses RLS internally, so
-- policies that call it don't recurse into profiles' own RLS (which would
-- include this same policy) the way an inline subquery on profiles would.
create or replace function is_admin() returns boolean
language sql security definer stable as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

-- Profiles
create policy "own profile"          on profiles  for all  using (auth.uid() = id);
create policy "admin reads all profiles" on profiles for select using (is_admin());
-- Providers
create policy "providers readable"   on providers for select using (true);
create policy "own provider"         on providers for all   using (auth.uid() = user_id);
-- Requests
create policy "own requests"         on requests  for all   using (auth.uid() = client_id);
create policy "requests readable"    on requests  for select using (true);
-- Offers
create policy "offers readable"      on offers    for select using (true);
create policy "provider sends offer" on offers    for insert with check (
  exists (select 1 from providers p where p.id = provider_id and p.user_id = auth.uid())
);
-- Jobs
create policy "job parties"          on jobs      for all   using (auth.uid() = client_id or auth.uid() = (select user_id from providers where id = jobs.provider_id));
create policy "admin reads all jobs" on jobs for select using (is_admin());
-- Job payments (PayDunya) — writes happen via the service-role key only (Edge Functions)
create policy "job payment parties"  on job_payments for select using (
  auth.uid() = client_id or auth.uid() = (select user_id from providers where id = job_payments.provider_id)
);
-- Only a service-role write (the PayDunya webhook) can mark a job as paid —
-- a client's own session cannot self-grant payment_status='paid'.
create or replace function protect_job_payment_status() returns trigger
language plpgsql as $$
begin
  if auth.role() = 'authenticated' then
    new.payment_status := old.payment_status;
  end if;
  return new;
end; $$;
create trigger trg_protect_job_payment_status before update on jobs
  for each row execute function protect_job_payment_status();
-- Withdrawal requests (manual payout)
create policy "provider reads own withdrawals" on withdrawal_requests for select using (
  auth.uid() = user_id or is_admin()
);
create policy "provider requests withdrawal" on withdrawal_requests for insert with check (auth.uid() = user_id);
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
create trigger trg_notify_withdrawal_sent after update on withdrawal_requests
  for each row execute function notify_withdrawal_sent();
-- Messages
create policy "msgs in own thread"   on messages  for all   using (
  exists (select 1 from requests r where r.id = messages.request_id and r.client_id = auth.uid())
  or sender_id = auth.uid()
);
-- Reviews
create policy "reviews readable"     on reviews   for select using (true);
create policy "own review"           on reviews   for insert with check (auth.uid() = author_id);
-- Favorites
create policy "own favorites"        on favorites for all   using (auth.uid() = user_id);
-- Notifications
create policy "own notifications"    on notifications for all using (auth.uid() = user_id);
-- Disputes
create policy "dispute parties"      on disputes  for all   using (auth.uid() = reporter_id);
-- Verification requests
create policy "submit own verification" on verification_requests for insert with check (auth.uid() = user_id);
create policy "read verifications"      on verification_requests for select using (true);
create policy "update verifications"    on verification_requests for update using (true);

-- ---- Appointment booking (Beauty & Wellness) — see migration_booking.sql ----
alter table providers add column if not exists bookable boolean not null default false;

create table if not exists provider_services (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references providers(id) on delete cascade,
  name text not null,
  duration_minutes int not null check (duration_minutes > 0),
  price int not null check (price >= 0),
  deposit_amount int not null default 0 check (deposit_amount >= 0),
  active boolean not null default true,
  created_at timestamptz default now()
);
create index if not exists provider_services_provider_idx on provider_services(provider_id);

create table if not exists provider_availability (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references providers(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null check (end_time > start_time),
  created_at timestamptz default now()
);
create index if not exists provider_availability_provider_idx on provider_availability(provider_id);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references providers(id) on delete set null,
  client_id uuid references auth.users(id) on delete set null,
  service_id uuid references provider_services(id) on delete set null,
  service_name text not null,
  price int not null,
  duration_minutes int not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('confirmed','cancelled','completed','no_show')),
  deposit_amount int not null default 0,
  deposit_status text not null default 'pending' check (deposit_status in ('none','pending','paid','failed')),
  paydunya_token text unique,
  invoice_url text,
  created_at timestamptz default now(),
  confirmed_at timestamptz
);
create index if not exists appointments_provider_idx on appointments(provider_id);
create index if not exists appointments_client_idx on appointments(client_id);
create index if not exists appointments_starts_idx on appointments(provider_id, starts_at);

alter table provider_services   enable row level security;
alter table provider_availability enable row level security;
alter table appointments        enable row level security;

create policy "services readable"    on provider_services    for select using (true);
create policy "own services"         on provider_services    for all using (
  exists (select 1 from providers p where p.id = provider_services.provider_id and p.user_id = auth.uid())
);
create policy "availability readable" on provider_availability for select using (true);
create policy "own availability"      on provider_availability for all using (
  exists (select 1 from providers p where p.id = provider_availability.provider_id and p.user_id = auth.uid())
);
create policy "appointment parties"  on appointments for select using (
  auth.uid() = client_id or auth.uid() = (select user_id from providers where id = appointments.provider_id) or is_admin()
);
create policy "client cancels own appointment" on appointments for update using (auth.uid() = client_id);
create policy "provider manages own appointment" on appointments for update using (
  auth.uid() = (select user_id from providers where id = appointments.provider_id)
);

create or replace function protect_appointment_deposit_status() returns trigger
language plpgsql as $$
begin
  if auth.role() = 'authenticated' then
    new.deposit_status := old.deposit_status;
    new.paydunya_token := old.paydunya_token;
    new.invoice_url := old.invoice_url;
  end if;
  return new;
end; $$;
create trigger trg_protect_appointment_deposit_status before update on appointments
  for each row execute function protect_appointment_deposit_status();

create or replace function notify_appointment_booked() returns trigger
language plpgsql security definer as $$
declare v_provider_user uuid; v_client_name text;
begin
  if new.deposit_status in ('paid', 'none') and (old is null or old.deposit_status is distinct from new.deposit_status) then
    select user_id into v_provider_user from providers where id = new.provider_id;
    select coalesce(full_name, 'Client') into v_client_name from profiles where id = new.client_id;
    if v_provider_user is not null then
      insert into notifications (user_id, type, title, body, action_route)
      values (v_provider_user, 'system', 'Nouveau rendez-vous 📅',
              v_client_name || ' a réservé ' || new.service_name || '.', '/provider/agenda');
    end if;
    if new.client_id is not null then
      insert into notifications (user_id, type, title, body, action_route)
      values (new.client_id, 'system', 'Rendez-vous confirmé ✅',
              'Votre rendez-vous pour ' || new.service_name || ' est confirmé.', '/client/appointments');
    end if;
  end if;
  return new;
end; $$;
create trigger trg_notify_appointment_booked after insert or update on appointments
  for each row execute function notify_appointment_booked();

-- ---- Discount codes (commission + Sèvizi Pro membership) — see migration_discounts.sql ----
create table if not exists discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text,
  kind text not null check (kind in ('percent', 'flat')),
  applies_to text not null check (applies_to in ('commission', 'membership', 'both')),
  value int not null check (value >= 0),
  duration_days int,
  max_redemptions int,
  redemption_count int not null default 0,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references discount_codes(id) on delete cascade,
  provider_id uuid references providers(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  purpose text not null check (purpose in ('commission', 'membership')),
  amount_saved int,
  created_at timestamptz default now(),
  unique (code_id, provider_id)
);

alter table providers add column if not exists commission_discount_pct int not null default 0 check (commission_discount_pct between 0 and 100);
alter table providers add column if not exists commission_discount_until timestamptz;
alter table pro_payments add column if not exists discount_code_id uuid references discount_codes(id) on delete set null;
alter table pro_payments add column if not exists discount_amount int not null default 0;

alter table discount_codes       enable row level security;
alter table discount_redemptions enable row level security;

create policy "admin manages discount codes" on discount_codes for all using (is_admin());
create policy "admin reads all redemptions"  on discount_redemptions for select using (is_admin());
create policy "provider reads own redemptions" on discount_redemptions for select using (auth.uid() = user_id);

create or replace function redeem_discount_code(p_code text, p_purpose text) returns jsonb
language plpgsql security definer as $$
declare
  v_code discount_codes%rowtype;
  v_provider providers%rowtype;
begin
  select * into v_provider from providers where user_id = auth.uid() order by created_at limit 1;
  if v_provider.id is null then
    raise exception 'Profil prestataire introuvable.';
  end if;

  select * into v_code from discount_codes where code = upper(trim(p_code));
  if v_code.id is null then
    raise exception 'Code invalide.';
  end if;
  if not v_code.active then
    raise exception 'Ce code n''est plus actif.';
  end if;
  if v_code.expires_at is not null and v_code.expires_at < now() then
    raise exception 'Ce code a expiré.';
  end if;
  if v_code.applies_to <> p_purpose and v_code.applies_to <> 'both' then
    raise exception 'Ce code ne s''applique pas ici.';
  end if;
  if v_code.max_redemptions is not null and v_code.redemption_count >= v_code.max_redemptions then
    raise exception 'Ce code a atteint sa limite d''utilisation.';
  end if;
  if exists (select 1 from discount_redemptions where code_id = v_code.id and provider_id = v_provider.id) then
    raise exception 'Vous avez déjà utilisé ce code.';
  end if;

  if p_purpose = 'commission' then
    if v_code.kind <> 'percent' then
      raise exception 'Ce code ne s''applique pas à la commission.';
    end if;
    update providers set
      commission_discount_pct = v_code.value,
      commission_discount_until = case when v_code.duration_days is null then null else now() + (v_code.duration_days || ' days')::interval end
    where id = v_provider.id;

    insert into discount_redemptions (code_id, provider_id, user_id, purpose)
    values (v_code.id, v_provider.id, auth.uid(), p_purpose);
    update discount_codes set redemption_count = redemption_count + 1 where id = v_code.id;
  end if;

  return jsonb_build_object('codeId', v_code.id, 'kind', v_code.kind, 'value', v_code.value, 'label', v_code.label, 'durationDays', v_code.duration_days);
end; $$;
