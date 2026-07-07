-- Sèvizi — Provider wallet + manual withdrawal requests
-- Run in Supabase → SQL Editor (idempotent).
--
-- Providers accumulate a net balance (job price minus Sèvizi's commission)
-- as jobs get paid via PayDunya. Rather than an automated payout, they
-- request a withdrawal (amount + mobile money method + number), an admin
-- sees the request and sends the money manually outside the app, then
-- marks it as sent.

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

-- A provider's withdrawable balance: net earnings from completed job
-- payments, minus anything already requested (pending or sent) — so a
-- provider can't request the same money twice while a request is in flight.
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
  auth.uid() = user_id
  or exists (select 1 from profiles where id = auth.uid() and is_admin)
);

drop policy if exists "provider requests withdrawal" on withdrawal_requests;
create policy "provider requests withdrawal" on withdrawal_requests for insert with check (auth.uid() = user_id);

drop policy if exists "admin resolves withdrawal" on withdrawal_requests;
create policy "admin resolves withdrawal" on withdrawal_requests for update using (
  exists (select 1 from profiles where id = auth.uid() and is_admin)
);

-- Notify the provider once an admin marks their withdrawal as sent.
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
