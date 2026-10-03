-- Sèvizi — stop users from granting themselves a paid Sèvi Go plan
-- Run in Supabase → SQL Editor (idempotent).
--
-- The "own subscription" policy is `for all using (auth.uid() = user_id)`,
-- so any signed-in user could write plan_id = 'unlimited' (or reset their
-- invoice counter) straight into their own row and skip the monthly fee —
-- the payment gate only existed in the app. Paid plans may only be written
-- by the service role (sevigo-plan-payment-webhook / sevigo-create-plan-payment).
--
-- A user may still: downgrade to 'payg' (free) and have the usage counter
-- bumped by bump_sevigo_invoice_usage. pg_trigger_depth() tells those two
-- apart: a direct user write runs at depth 1, the counter bump (an upsert
-- fired from inside the invoice trigger) runs deeper.

create or replace function protect_sevigo_subscription() returns trigger
language plpgsql as $$
begin
  if auth.role() = 'authenticated' and pg_trigger_depth() = 1 then
    if tg_op = 'INSERT' then
      new.plan_id := 'payg';
      new.invoices_this_cycle := 0;
    else
      if new.plan_id is distinct from old.plan_id and new.plan_id <> 'payg' then
        new.plan_id := old.plan_id;
      end if;
      new.invoices_this_cycle := old.invoices_this_cycle;
      new.cycle_start := old.cycle_start;
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_protect_sevigo_subscription on sevigo_subscriptions;
create trigger trg_protect_sevigo_subscription before insert or update on sevigo_subscriptions
  for each row execute function protect_sevigo_subscription();
