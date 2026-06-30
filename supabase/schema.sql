-- Sèvizi — Supabase schema
-- Run in the Supabase SQL editor. Requires the postgis extension.

create extension if not exists postgis;

-- ---- Enums ----
create type service_category as enum (
  'plomberie','electricite','peinture','menuiserie',
  'coiffure','mecanique','couture','menage',
  'cuisine','transport','reparation','cours'
);
create type request_status as enum ('ouverte','en_cours','terminee','annulee');
create type user_role as enum ('client','prestataire');
create type job_status as enum ('accepte','en_route','arrive','en_cours','termine');
create type payment_method as enum ('cash','flooz','mixx');
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
  created_at timestamptz default now()
);
create index providers_geo_idx on providers using gist (geo);

-- ---- Requests ----
create table requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users(id) on delete cascade,
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
  provider_id uuid not null references providers(id) on delete cascade,
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
  offer_id uuid not null references offers(id) on delete cascade,
  request_id uuid not null references requests(id) on delete cascade,
  provider_id uuid not null references providers(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  price int not null,
  payment_method payment_method default 'cash',
  status job_status not null default 'accepte',
  accepted_at timestamptz default now(),
  completed_at timestamptz
);
create index jobs_provider_idx on jobs(provider_id);
create index jobs_client_idx on jobs(client_id);

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
  author_id uuid not null references auth.users(id) on delete cascade,
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
  reporter_id uuid not null references auth.users(id) on delete cascade,
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
  lat double precision, lng double precision, distance_km double precision
)
language sql stable as $$
  select p.id, p.name, p.category, p.rating, p.reviews, p.verified, p.online,
         p.missions, p.years_active, p.response_rate, p.bio,
         st_y(p.geo::geometry) as lat,
         st_x(p.geo::geometry) as lng,
         round((st_distance(p.geo, st_setsrid(st_makepoint(lng, lat),4326)::geography)/1000)::numeric, 2) as distance_km
  from providers p
  where p.online
    and (cat is null or p.category = cat)
    and st_dwithin(p.geo, st_setsrid(st_makepoint(lng, lat),4326)::geography, radius_km*1000)
  order by distance_km;
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

-- Profiles
create policy "own profile"          on profiles  for all  using (auth.uid() = id);
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
