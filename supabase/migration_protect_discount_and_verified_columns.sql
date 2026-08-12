-- Sèvizi — close a privilege-escalation gap: commission_discount_pct/until
-- and verified were writable directly by a provider's own session via the
-- permissive "own provider" RLS policy, bypassing redeem_discount_code()'s
-- validation (max redemptions, expiry, active flag) and admin verification
-- review entirely. Extends the same authenticated-role reset pattern
-- already used for tier/pro_since (protect_provider_tier_columns /
-- trg_protect_provider_tier in migration_paydunya.sql) to cover these too.
-- Run in Supabase → SQL Editor (idempotent).

create or replace function protect_provider_tier_columns() returns trigger
language plpgsql as $$
begin
  if auth.role() = 'authenticated' then
    if tg_op = 'INSERT' then
      new.tier := 'free';
      new.pro_since := null;
      new.commission_discount_pct := 0;
      new.commission_discount_until := null;
      new.verified := false;
    elsif tg_op = 'UPDATE' then
      new.tier := old.tier;
      new.pro_since := old.pro_since;
      new.commission_discount_pct := old.commission_discount_pct;
      new.commission_discount_until := old.commission_discount_until;
      new.verified := old.verified;
    end if;
  end if;
  return new;
end; $$;

-- Trigger already exists (trg_protect_provider_tier before insert or update
-- on providers) — replacing the function body above is sufficient, no need
-- to recreate the trigger itself.
