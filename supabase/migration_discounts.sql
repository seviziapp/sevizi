-- Sèvizi — Admin-managed discount codes for commission and Sèvizi Pro
-- membership fees. Run in Supabase → SQL Editor (idempotent).
--
-- A code either reduces a provider's ongoing commission rate ('commission',
-- applied immediately via redeem_discount_code) or discounts the Sèvizi Pro
-- checkout price ('membership', applied by paydunya-create-invoice and only
-- actually consumed once paydunya-webhook confirms the payment — an
-- abandoned checkout must not burn a redemption slot). 'both' codes work
-- for either. `value` on a 'percent' code is a discount OFF the normal
-- rate/price (e.g. 50 = half price / half commission); on a 'flat' code
-- it's a flat FCFA amount off — flat codes only apply to membership, since
-- there's no flat amount to take "off" a commission rate.

create table if not exists discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text,
  kind text not null check (kind in ('percent', 'flat')),
  applies_to text not null check (applies_to in ('commission', 'membership', 'both')),
  value int not null check (value >= 0),
  duration_days int,              -- commission codes only: null = discount stays until an admin removes it
  max_redemptions int,            -- null = unlimited
  redemption_count int not null default 0,
  active boolean not null default true,
  expires_at timestamptz,         -- code can no longer be redeemed after this
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
  unique (code_id, provider_id)   -- one redemption per code per provider
);

alter table providers add column if not exists commission_discount_pct int not null default 0 check (commission_discount_pct between 0 and 100);
alter table providers add column if not exists commission_discount_until timestamptz;

-- pro_payments gains discount tracking so paydunya-webhook can consume the
-- redemption only once the payment is actually confirmed.
alter table pro_payments add column if not exists discount_code_id uuid references discount_codes(id) on delete set null;
alter table pro_payments add column if not exists discount_amount int not null default 0;

alter table discount_codes       enable row level security;
alter table discount_redemptions enable row level security;

create policy "admin manages discount codes" on discount_codes for all using (is_admin());
create policy "admin reads all redemptions"  on discount_redemptions for select using (is_admin());
create policy "provider reads own redemptions" on discount_redemptions for select using (auth.uid() = user_id);
-- No client insert/update policy on either table — redemption happens only
-- through redeem_discount_code() (commission) or the service-role Edge
-- Functions (membership), both of which bypass RLS.

-- Validates and (for 'commission') immediately applies a code to the calling
-- provider's account. For 'membership', this only validates + records the
-- redemption — the actual price discount and Pro grant happen elsewhere
-- (paydunya-create-invoice / paydunya-webhook), since a code shouldn't be
-- consumed until checkout genuinely completes. Kept here so both paths share
-- one source of truth for "is this code currently usable by this provider".
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

  -- p_purpose = 'membership': deliberately no redemption row / count bump
  -- here — paydunya-create-invoice re-validates with this same logic and
  -- paydunya-webhook records the redemption only on confirmed payment.

  return jsonb_build_object('codeId', v_code.id, 'kind', v_code.kind, 'value', v_code.value, 'label', v_code.label, 'durationDays', v_code.duration_days);
end; $$;
