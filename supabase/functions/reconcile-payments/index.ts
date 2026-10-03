// Sèvizi — safety net for PayDunya payments whose webhook never landed.
// Runs on a schedule (pg_cron → pg_net, see migration_reconcile_payments.sql).
// For every payment still 'pending' after a grace period, it re-sends the
// token to that payment type's own webhook, which re-confirms the real status
// with PayDunya and applies the result exactly as a normal callback would
// (grant access if paid, mark failed/cancelled otherwise). The webhooks are
// idempotent, so running this on payments that are fine is harmless. Nothing
// here trusts a client — it only asks PayDunya, through the webhooks.
//
// Protected by a shared secret header instead of a user JWT, because the
// caller is the database scheduler, not a signed-in user.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET');

const GRACE_MINUTES = 5;       // let the normal webhook win first
const LOOKBACK_DAYS = 14;      // older than this is a dead checkout

type Source = { webhook: string; table: string; tokenCol: string; statusCol: string };
const SOURCES: Source[] = [
  { webhook: 'paydunya-webhook', table: 'pro_payments', tokenCol: 'paydunya_token', statusCol: 'status' },
  { webhook: 'sevigo-plan-payment-webhook', table: 'sevigo_plan_payments', tokenCol: 'paydunya_token', statusCol: 'status' },
  { webhook: 'sevigo-generation-fee-webhook', table: 'sevigo_invoice_generation_fees', tokenCol: 'paydunya_token', statusCol: 'status' },
  { webhook: 'sevigo-invoice-webhook', table: 'sevigo_invoice_payments', tokenCol: 'paydunya_token', statusCol: 'status' },
  { webhook: 'paydunya-job-webhook', table: 'job_payments', tokenCol: 'paydunya_token', statusCol: 'status' },
  { webhook: 'paydunya-appointment-webhook', table: 'appointments', tokenCol: 'paydunya_token', statusCol: 'deposit_status' },
];

Deno.serve(async (req: Request) => {
  if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response('forbidden', { status: 403 });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const before = new Date(Date.now() - GRACE_MINUTES * 60_000).toISOString();
  const after = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();

  const report: Record<string, { checked: number; failed: number }> = {};

  for (const src of SOURCES) {
    const { data, error } = await admin
      .from(src.table).select(src.tokenCol)
      .eq(src.statusCol, 'pending').not(src.tokenCol, 'is', null)
      .lt('created_at', before).gt('created_at', after).limit(100);
    if (error) { console.error(src.table, error.message); report[src.table] = { checked: 0, failed: -1 }; continue; }

    let failed = 0;
    for (const row of data ?? []) {
      const token = (row as Record<string, string>)[src.tokenCol];
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/${src.webhook}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ 'data[invoice][token]': token }).toString(),
        });
        if (!res.ok) failed++;
      } catch (e) {
        failed++;
        console.error(src.webhook, e instanceof Error ? e.message : e);
      }
    }
    report[src.table] = { checked: data?.length ?? 0, failed };
  }

  return new Response(JSON.stringify(report), { headers: { 'Content-Type': 'application/json' } });
});
