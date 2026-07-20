-- Sèvizi — Appointment booking (Beauty & Wellness)
-- Run in Supabase → SQL Editor. Idempotent.
--
-- Any provider can flip `bookable = true` on their own profile to switch their
-- public listing from "Demander un devis" to "Prendre rendez-vous". Bookable
-- providers define a service menu (name/duration/price) and weekly working
-- hours; the app computes free slots client-side from those two tables minus
-- existing appointments. A deposit (flat amount, set per service by the
-- provider) is collected via PayDunya before a slot is actually held, using
-- the same create-invoice / webhook pattern as job payments.

alter table providers add column if not exists bookable boolean not null default false;

-- ---- Service menu ----
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

-- ---- Weekly working hours ----
-- day_of_week: 0 = Sunday … 6 = Saturday.
create table if not exists provider_availability (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references providers(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null check (end_time > start_time),
  created_at timestamptz default now()
);
create index if not exists provider_availability_provider_idx on provider_availability(provider_id);

-- ---- Appointments ----
create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references providers(id) on delete set null,
  client_id uuid references auth.users(id) on delete set null,
  service_id uuid references provider_services(id) on delete set null,
  service_name text not null,        -- denormalized so it survives service edits/deletes
  price int not null,                -- denormalized service price at booking time
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

-- ---- RLS ----
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
-- Client can cancel their own upcoming appointment; provider can update status
-- (completed/no_show/cancelled) on their own appointments. deposit_status/
-- paydunya_token/invoice_url are locked down separately below.
create policy "client cancels own appointment" on appointments for update using (
  auth.uid() = client_id
);
create policy "provider manages own appointment" on appointments for update using (
  auth.uid() = (select user_id from providers where id = appointments.provider_id)
);

-- Only a service-role write (the deposit webhook) can mark a deposit paid —
-- mirrors trg_protect_job_payment_status for job_payments.
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

-- Notify both parties on a new confirmed booking (fires once the deposit is
-- marked paid by the webhook, or immediately for a zero-deposit service).
create or replace function notify_appointment_booked() returns trigger
language plpgsql security definer as $$
declare v_provider_user uuid; v_client_name text;
begin
  -- Fires once the booking is actually settled: either no deposit was required
  -- ('none', set immediately on insert) or the deposit was just confirmed paid
  -- by the webhook. Guards against re-firing on unrelated updates (status
  -- changes to completed/no_show/cancelled don't touch deposit_status).
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
