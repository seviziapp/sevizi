-- Sèvi Go annual plans: remember whether a plan payment was for a month or a
-- year, so the webhook (and the reconcile job replaying it) grants the right
-- period (30 vs 365 days). Existing payments are monthly. Idempotent.
alter table sevigo_plan_payments add column if not exists billing_cycle text not null default 'monthly';
do $$ begin
  alter table sevigo_plan_payments add constraint sevigo_plan_payments_billing_cycle_check check (billing_cycle in ('monthly', 'annual'));
exception when duplicate_object then null; end $$;
