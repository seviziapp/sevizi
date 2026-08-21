// Sèvizi — PayDunya IPN (webhook) for client -> provider job payments.
// Anonymous (verify_jwt OFF) — PayDunya calls this directly. We never trust
// the request body itself; we take only the token and re-confirm the real
// status with PayDunya's API using our own private key before marking
// anything as paid.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { confirmInvoice, extractWebhookToken } from '../_shared/paydunya.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req: Request) => {
  try {
    const token = await extractWebhookToken(req);
    const confirm = await confirmInvoice(token);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: payment } = await admin
      .from('job_payments').select('*').eq('paydunya_token', token).single();
    if (!payment) throw new Error('Paiement introuvable');

    // Idempotent: PayDunya may call this more than once for the same invoice.
    if (payment.status === 'completed') {
      return new Response('ok', { status: 200 });
    }

    if (confirm.status === 'completed') {
      await admin.from('job_payments')
        .update({ status: 'completed', confirmed_at: new Date().toISOString() })
        .eq('id', payment.id);
      // The only place allowed to mark a job as paid — service-role write,
      // bypasses trg_protect_job_payment_status on `jobs`.
      await admin.from('jobs')
        .update({ payment_status: 'paid', payment_method: 'paydunya' })
        .eq('id', payment.job_id);
    } else {
      await admin.from('job_payments')
        .update({ status: confirm.status === 'cancelled' ? 'cancelled' : 'failed' })
        .eq('id', payment.id);
    }

    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response('error', { status: 400 });
  }
});
