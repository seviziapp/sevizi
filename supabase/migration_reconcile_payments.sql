-- Sèvizi — scheduled safety net for PayDunya payments whose webhook never landed
-- Run in Supabase → SQL Editor (idempotent).
--
-- Every 15 minutes the database calls the reconcile-payments Edge Function,
-- which re-checks any payment still 'pending' after 5 minutes with PayDunya
-- (through each payment type's own webhook) and applies the result. Normal
-- payments are confirmed instantly by the webhook; this only catches the
-- ones where that callback was lost or failed, so nobody pays and gets nothing.
--
-- The shared secret is NOT stored in this file. After running it, schedule
-- once with the same value set as the CRON_SECRET function secret:
--   select schedule_payment_reconcile('<CRON_SECRET value>');

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function schedule_payment_reconcile(p_secret text) returns void
language plpgsql security definer as $$
begin
  perform cron.unschedule('reconcile-payments')
    from cron.job where jobname = 'reconcile-payments';
  perform cron.schedule(
    'reconcile-payments',
    '*/15 * * * *',
    format(
      $job$select net.http_post(
        url := 'https://mrptqmkbdnvrutnfpwwp.supabase.co/functions/v1/reconcile-payments',
        headers := jsonb_build_object('x-cron-secret', %L, 'Content-Type', 'application/json'),
        body := '{}'::jsonb
      )$job$, p_secret)
  );
end; $$;

-- Only the database owner may (re)schedule it.
revoke all on function schedule_payment_reconcile(text) from public, anon, authenticated;
