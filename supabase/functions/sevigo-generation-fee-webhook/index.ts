// Sèvi Go — PayDunya IPN (webhook) for invoice generation fee payments.
// Anonymous (verify_jwt OFF) — PayDunya calls this directly. We never trust
// the request body itself; we take only the token and re-confirm the real
// status with PayDunya's API using our own private key before unlocking
// anything. This is the ONLY place that flips an invoice out of
// 'pending_fee' — the whole point of the gate is that nothing else can.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { confirmInvoice, extractWebhookToken } from '../_shared/paydunya.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req: Request) => {
  try {
    const token = await extractWebhookToken(req);
    const confirm = await confirmInvoice(token);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: fee } = await admin
      .from('sevigo_invoice_generation_fees').select('*').eq('paydunya_token', token).single();
    if (!fee) throw new Error('Frais introuvable');

    // Idempotent: PayDunya may call this more than once for the same invoice.
    if (fee.status === 'completed') {
      return new Response('ok', { status: 200 });
    }

    if (confirm.status === 'completed') {
      await admin.from('sevigo_invoice_generation_fees')
        .update({ status: 'completed', confirmed_at: new Date().toISOString() })
        .eq('id', fee.id);
      await admin.from('sevigo_invoices')
        .update({ status: 'draft' })
        .eq('id', fee.invoice_id)
        .eq('status', 'pending_fee'); // no-op if somehow already unlocked
      if (fee.referral_credit_applied > 0) {
        await admin.from('referral_credits').insert({
          user_id: fee.user_id, amount: -fee.referral_credit_applied,
          kind: 'spend_sevigo_fee', note: 'Frais de génération de facture',
        });
      }
    } else {
      await admin.from('sevigo_invoice_generation_fees')
        .update({ status: confirm.status === 'cancelled' ? 'cancelled' : 'failed' })
        .eq('id', fee.id);
    }

    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response('error', { status: 400 });
  }
});
