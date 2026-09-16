-- Sèvi Go — POS / invoicing module, built as a feature inside sevizi.app
-- (not a separate project). Run in Supabase → SQL Editor. Idempotent.
--
-- Plans: payg / starter / growth / unlimited — see src/lib/sevigo/types.ts
-- (SEVIGO_PLANS) for the pricing table; keep both in sync if pricing changes.

-- ---- Subscription / usage metering ----
create table if not exists sevigo_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_id text not null default 'payg' check (plan_id in ('payg','starter','growth','unlimited')),
  cycle_start timestamptz not null default date_trunc('month', now()),
  invoices_this_cycle int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---- Business profile (used to prefill invoices) ----
create table if not exists sevigo_business_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  business_name text not null,
  logo_url text,
  brand_color text,
  contact_email text,
  contact_phone text,
  address text,
  updated_at timestamptz default now()
);

-- ---- Invoices ----
create table if not exists sevigo_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  number text not null,
  client_name text not null,
  client_contact text,
  client_email text,
  discount_pct numeric,
  discount_flat int,
  subtotal int not null default 0,
  total int not null default 0,
  status text not null default 'draft' check (status in ('draft','sent','paid','overdue','cancelled')),
  template text not null default 'classic' check (template in ('classic','modern','minimal')),
  due_date timestamptz,
  notes text,
  payment_url text,
  paydunya_token text unique,
  created_at timestamptz default now(),
  paid_at timestamptz
);
create index if not exists sevigo_invoices_user_idx on sevigo_invoices(user_id, created_at desc);
create unique index if not exists sevigo_invoices_user_number_idx on sevigo_invoices(user_id, number);

create table if not exists sevigo_invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references sevigo_invoices(id) on delete cascade,
  description text not null,
  quantity numeric not null default 1 check (quantity > 0),
  unit_price int not null check (unit_price >= 0),
  discount_pct numeric
);
create index if not exists sevigo_invoice_items_invoice_idx on sevigo_invoice_items(invoice_id);

-- ---- Payments (PayDunya) ----
create table if not exists sevigo_invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references sevigo_invoices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount int not null,
  sevigo_fee int not null default 0,
  net_amount int not null,
  status text not null default 'pending' check (status in ('pending','completed','failed','cancelled')),
  paydunya_token text unique,
  created_at timestamptz default now(),
  confirmed_at timestamptz
);
create index if not exists sevigo_invoice_payments_invoice_idx on sevigo_invoice_payments(invoice_id);

-- ---- RLS ----
alter table sevigo_subscriptions      enable row level security;
alter table sevigo_business_profiles  enable row level security;
alter table sevigo_invoices           enable row level security;
alter table sevigo_invoice_items      enable row level security;
alter table sevigo_invoice_payments   enable row level security;

create policy "own subscription"      on sevigo_subscriptions     for all using (auth.uid() = user_id);
create policy "own business profile"  on sevigo_business_profiles for all using (auth.uid() = user_id);
create policy "own invoices"          on sevigo_invoices          for all using (auth.uid() = user_id);
create policy "own invoice items"     on sevigo_invoice_items     for all using (
  exists (select 1 from sevigo_invoices i where i.id = sevigo_invoice_items.invoice_id and i.user_id = auth.uid())
);
create policy "own invoice payments"  on sevigo_invoice_payments  for select using (auth.uid() = user_id);

-- Only a service-role write (the payment webhook) can set payment_url/
-- paydunya_token/paid_at — mirrors protect_job_payment_status for job_payments.
create or replace function protect_sevigo_invoice_payment_fields() returns trigger
language plpgsql as $$
begin
  if auth.role() = 'authenticated' then
    new.payment_url := old.payment_url;
    new.paydunya_token := old.paydunya_token;
    new.paid_at := old.paid_at;
  end if;
  return new;
end; $$;
create trigger trg_protect_sevigo_invoice_payment_fields before update on sevigo_invoices
  for each row execute function protect_sevigo_invoice_payment_fields();

-- Keep invoices_this_cycle in sync so plan usage caps (Starter: 15 included,
-- Growth: 50 included) can be enforced without a separate count query.
create or replace function bump_sevigo_invoice_usage() returns trigger
language plpgsql security definer as $$
begin
  insert into sevigo_subscriptions (user_id, invoices_this_cycle)
  values (new.user_id, 1)
  on conflict (user_id) do update
    set invoices_this_cycle = sevigo_subscriptions.invoices_this_cycle + 1,
        updated_at = now();
  return new;
end; $$;
create trigger trg_bump_sevigo_invoice_usage after insert on sevigo_invoices
  for each row execute function bump_sevigo_invoice_usage();
