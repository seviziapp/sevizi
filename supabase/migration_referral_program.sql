-- Sèvizi — affiliate/referral program
-- Run in Supabase → SQL Editor (idempotent).
--
-- Any user picks their own custom code. When a NEW user enters someone's
-- code while finishing signup (onboarding/client-details or
-- onboarding/provider-details), both the referrer and the new user get
-- 300F credited to a restricted balance — never cash, never withdrawable,
-- never usable toward paying a service provider. It can only reduce what
-- Sèvizi itself charges: the Sèvizi Pro subscription, a Sèvi Go paid plan's
-- monthly fee, and Sèvi Go's per-invoice generation fee. Applied
-- server-side in paydunya-create-invoice, sevigo-create-plan-payment, and
-- sevigo-create-generation-fee-payment (mirrors the existing discount-code
-- pattern: reduces the amount actually sent to PayDunya, and is only
-- actually *spent* from the ledger once the matching webhook confirms
-- payment — an abandoned checkout never burns credit).

-- ---- 1) One self-chosen code per user ----
create table if not exists referral_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz default now()
);
alter table referral_codes enable row level security;
drop policy if exists "referral codes readable" on referral_codes;
create policy "referral codes readable" on referral_codes for select using (true);
drop policy if exists "own referral code insert" on referral_codes;
create policy "own referral code insert" on referral_codes for insert with check (auth.uid() = user_id);

-- ---- 2) Credit ledger (positive = grant, negative = spend) ----
create table if not exists referral_credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount int not null,
  kind text not null check (kind in ('bonus_referrer', 'bonus_referee', 'spend_pro', 'spend_sevigo_plan', 'spend_sevigo_fee')),
  related_user_id uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz default now()
);
alter table referral_credits enable row level security;
drop policy if exists "own referral credits" on referral_credits;
create policy "own referral credits" on referral_credits for select using (auth.uid() = user_id);
-- No insert/update/delete policy for regular users — every row is written
-- by a SECURITY DEFINER function (redeem_referral_code) or a service-role
-- Edge Function (the three create-payment functions / their webhooks).

-- ---- 3) One-time redemption record (blocks reuse and self-referral) ----
create table if not exists referral_signups (
  id uuid primary key default gen_random_uuid(),
  referee_id uuid not null unique references auth.users(id) on delete cascade,
  referrer_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  created_at timestamptz default now()
);
alter table referral_signups enable row level security;
drop policy if exists "own referral signup" on referral_signups;
create policy "own referral signup" on referral_signups for select using (auth.uid() = referee_id or auth.uid() = referrer_id);

-- ---- 4) Balance reader (same shape/openness as provider_wallet_balance) ----
create or replace function referral_credit_balance(p_user_id uuid) returns int
language sql security definer stable as $$
  select coalesce(sum(amount), 0) from referral_credits where user_id = p_user_id;
$$;

-- ---- 5) Redemption — called by the NEW user once their signup completes ----
create or replace function redeem_referral_code(p_code text) returns json
language plpgsql security definer as $$
declare
  v_referrer_id uuid;
  v_referee_id uuid := auth.uid();
begin
  if v_referee_id is null then
    raise exception 'Non connecté';
  end if;
  if exists (select 1 from referral_signups where referee_id = v_referee_id) then
    raise exception 'Vous avez déjà utilisé un code de parrainage.';
  end if;

  select user_id into v_referrer_id from referral_codes where code = upper(trim(p_code));
  if v_referrer_id is null then
    raise exception 'Code de parrainage introuvable.';
  end if;
  if v_referrer_id = v_referee_id then
    raise exception 'Vous ne pouvez pas utiliser votre propre code.';
  end if;

  insert into referral_signups (referee_id, referrer_id, code) values (v_referee_id, v_referrer_id, upper(trim(p_code)));

  insert into referral_credits (user_id, amount, kind, related_user_id, note)
  values (v_referrer_id, 300, 'bonus_referrer', v_referee_id, 'Filleul inscrit');
  insert into referral_credits (user_id, amount, kind, related_user_id, note)
  values (v_referee_id, 300, 'bonus_referee', v_referrer_id, 'Bonus de bienvenue (parrainage)');

  return json_build_object('ok', true);
end;
$$;

-- ---- 6) Track credit applied on each Sèvizi-fee payment, for the webhook
-- to actually consume it once (and only once) payment is confirmed ----
alter table pro_payments add column if not exists referral_credit_applied int not null default 0;
alter table sevigo_plan_payments add column if not exists referral_credit_applied int not null default 0;
alter table sevigo_invoice_generation_fees add column if not exists referral_credit_applied int not null default 0;
