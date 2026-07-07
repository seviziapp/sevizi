-- Sèvizi — PayDunya for real client -> provider job payments
-- Run in Supabase → SQL Editor (idempotent).
--
-- Scope decision (confirmed with the app owner): Sèvizi collects the full
-- job amount for real via PayDunya (mobile money or card — no more cash).
-- The provider's net share (after commission) is computed and recorded
-- here, but actually remitting it to the provider is a manual/business-side
-- step for now — same as how the Pro subscription commission is handled.
-- Full automated payout (PayDunya disbursement API, refund handling, etc.)
-- is a bigger, separate piece of work.
--
-- Flow mirrors the Pro subscription integration:
--   1. paydunya-create-job-invoice (user's own JWT) creates a PayDunya
--      invoice for the job price, records a `pending` row here, returns
--      the checkout URL.
--   2. Client pays on PayDunya's hosted page.
--   3. paydunya-job-webhook re-confirms with PayDunya directly, then marks
--      the job as paid.

-- 'cash' stays in the enum for historical rows created before this change;
-- new jobs paid through the app record 'paydunya' instead.
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
-- No client insert/update policy: both Edge Functions write via the
-- service-role key, which bypasses RLS entirely.

-- Same protection as trg_protect_provider_tier: the existing "job parties"
-- policy lets a client update their own job row directly, which would let
-- them just set payment_status='paid' themselves without ever paying.
-- Only the webhook's service-role write can move that column now.
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
