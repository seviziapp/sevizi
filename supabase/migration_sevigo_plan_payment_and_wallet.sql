-- Sèvi Go — (1) paid plans (Starter/Growth/Unlimited) must be paid for via
-- PayDunya before they take effect — Pay As You Go (free) applies instantly.
-- (2) money collected from a client paying a Sèvi Go invoice (minus Sèvi
-- Go's commission) lands in the business owner's existing Sèvizi wallet —
-- the same one used for marketplace job earnings, withdrawable the same way.
-- Run in Supabase → SQL Editor. Idempotent.

-- ---- 1) Plan subscription payments ----
create table if not exists sevigo_plan_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null check (plan_id in ('starter','growth','unlimited')),
  amount int not null,
  status text not null default 'pending' check (status in ('pending','completed','failed','cancelled')),
  paydunya_token text unique,
  created_at timestamptz default now(),
  confirmed_at timestamptz
);
alter table sevigo_plan_payments enable row level security;
drop policy if exists "own plan payments" on sevigo_plan_payments;
create policy "own plan payments" on sevigo_plan_payments for select using (auth.uid() = user_id);

-- ---- 2) Wallet: fold in completed Sèvi Go invoice payments ----
-- A provider's existing wallet (job earnings) now also counts their Sèvi Go
-- invoice earnings, keyed by the same auth user behind that provider row.
create or replace function provider_wallet_balance(p_provider_id uuid) returns int
language sql stable as $$
  select coalesce((
    select sum(net_amount) from job_payments
    where provider_id = p_provider_id and status = 'completed'
  ), 0)
  + coalesce((
    select sum(sip.net_amount) from sevigo_invoice_payments sip
    where sip.status = 'completed'
      and sip.user_id = (select user_id from providers where id = p_provider_id)
  ), 0)
  - coalesce((
    select sum(amount) from withdrawal_requests
    where provider_id = p_provider_id and status in ('pending','sent')
  ), 0);
$$;

-- A Sèvi Go user with no `providers` row (a plain client running their own
-- invoicing, not a marketplace provider) gets a wallet keyed directly to
-- their auth user instead — withdrawal_requests.provider_id stays null for
-- these, distinguishing them from the provider-scoped ledger above.
create or replace function sevigo_wallet_balance(p_user_id uuid) returns int
language sql stable as $$
  select coalesce((
    select sum(net_amount) from sevigo_invoice_payments
    where user_id = p_user_id and status = 'completed'
  ), 0) - coalesce((
    select sum(amount) from withdrawal_requests
    where user_id = p_user_id and provider_id is null and status in ('pending','sent')
  ), 0);
$$;

create or replace function validate_withdrawal_request() returns trigger
language plpgsql as $$
declare v_balance int;
begin
  if new.provider_id is not null then
    v_balance := provider_wallet_balance(new.provider_id);
  else
    v_balance := sevigo_wallet_balance(new.user_id);
  end if;
  if new.amount > v_balance then
    raise exception 'Solde insuffisant pour ce retrait (solde disponible : % F).', v_balance;
  end if;
  return new;
end; $$;
