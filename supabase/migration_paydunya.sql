-- Sèvizi — PayDunya integration for Sèvizi Pro subscription payments
-- Run in Supabase → SQL Editor (idempotent).
--
-- Scope: this wires up REAL payment collection for the Sèvizi Pro monthly
-- subscription (5,000 F). It does NOT touch client -> provider job payments
-- (still cash/mobile money handled directly between the two parties) —
-- that's a separate, bigger piece of work (holding funds + payout/splitting
-- to the provider) that can follow once this is proven out.
--
-- Payment flow:
--   1. App calls the `paydunya-create-invoice` Edge Function (user's own
--      JWT) -> creates a PayDunya checkout invoice, records a `pending`
--      row here, returns the checkout URL.
--   2. Provider pays on PayDunya's hosted page (mobile money / card).
--   3. PayDunya calls the `paydunya-webhook` Edge Function. That function
--      re-confirms the payment status directly with PayDunya (never trusts
--      the raw webhook body) and, only then, flips the provider to Pro.
--
-- Both Edge Functions use the Supabase service-role key, so they bypass RLS.
-- The trigger below is the real safeguard: it makes sure NO authenticated
-- client session (i.e. a provider hitting the table directly, bypassing
-- payment) can grant itself tier='pro' — only service-role writes (the
-- webhook) can move that needle.

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

-- Lock tier/pro_since to service-role writes only (see comment above).
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
