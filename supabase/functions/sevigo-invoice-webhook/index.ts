// Sèvi Go — PayDunya IPN (webhook) for invoice payments. Anonymous
// (verify_jwt OFF) — PayDunya calls this directly. We never trust the
// request body itself; we take only the token and re-confirm the real
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
      .from('sevigo_invoice_payments').select('*').eq('paydunya_token', token).single();
    if (!payment) throw new Error('Paiement introuvable');

    // Idempotent: PayDunya may call this more than once for the same invoice.
    if (payment.status === 'completed') {
      return new Response('ok', { status: 200 });
    }

    if (confirm.status === 'completed') {
      await admin.from('sevigo_invoice_payments')
        .update({ status: 'completed', confirmed_at: new Date().toISOString() })
        .eq('id', payment.id);
      // The only place allowed to mark an invoice as paid — service-role
      // write, bypasses trg_protect_sevigo_invoice_payment_fields.
      await admin.from('sevigo_invoices')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', payment.invoice_id);
    } else {
      await admin.from('sevigo_invoice_payments')
        .update({ status: confirm.status === 'cancelled' ? 'cancelled' : 'failed' })
        .eq('id', payment.id);
    }

    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response('error', { status: 400 });
  }
});
