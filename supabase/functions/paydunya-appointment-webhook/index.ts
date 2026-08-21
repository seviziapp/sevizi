// Sèvizi — PayDunya IPN (webhook) for appointment deposits.
// Anonymous (verify_jwt OFF) — PayDunya calls this directly. We never trust
// the request body itself; we take only the token and re-confirm the real
// status with PayDunya's API before marking anything paid.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { confirmInvoice, extractWebhookToken } from '../_shared/paydunya.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req: Request) => {
  try {
    const token = await extractWebhookToken(req);
    const confirm = await confirmInvoice(token);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: appt } = await admin
      .from('appointments').select('*').eq('paydunya_token', token).single();
    if (!appt) throw new Error('Rendez-vous introuvable');

    // Idempotent: PayDunya may call this more than once for the same invoice.
    if (appt.deposit_status === 'paid') {
      return new Response('ok', { status: 200 });
    }

    if (confirm.status === 'completed') {
      await admin.from('appointments')
        .update({ deposit_status: 'paid', confirmed_at: new Date().toISOString() })
        .eq('id', appt.id);
    } else {
      // Deposit failed/cancelled — free the slot back up.
      await admin.from('appointments')
        .update({ deposit_status: 'failed', status: 'cancelled' })
        .eq('id', appt.id);
    }

    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response('error', { status: 400 });
  }
});
