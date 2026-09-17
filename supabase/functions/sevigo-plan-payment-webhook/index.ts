// Sèvi Go — PayDunya IPN (webhook) for paid-plan subscription payments.
// Anonymous (verify_jwt OFF) — PayDunya calls this directly. We never trust
// the request body itself; we take only the token and re-confirm the real
// status with PayDunya's API before actually switching the plan.
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
      .from('sevigo_plan_payments').select('*').eq('paydunya_token', token).single();
    if (!payment) throw new Error('Paiement introuvable');

    if (payment.status === 'completed') {
      return new Response('ok', { status: 200 });
    }

    if (confirm.status === 'completed') {
      await admin.from('sevigo_plan_payments')
        .update({ status: 'completed', confirmed_at: new Date().toISOString() })
        .eq('id', payment.id);
      await admin.from('sevigo_subscriptions')
        .upsert({ user_id: payment.user_id, plan_id: payment.plan_id }, { onConflict: 'user_id' });
    } else {
      await admin.from('sevigo_plan_payments')
        .update({ status: confirm.status === 'cancelled' ? 'cancelled' : 'failed' })
        .eq('id', payment.id);
    }

    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response('error', { status: 400 });
  }
});
