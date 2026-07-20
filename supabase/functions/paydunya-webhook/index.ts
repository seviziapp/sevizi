// Sèvizi — PayDunya IPN (webhook) for the Sèvizi Pro subscription.
// PayDunya calls this anonymously after a payment attempt, so verify_jwt is
// OFF for this function — but we never trust the request body itself (it
// could be forged by anyone who finds this URL). Instead, we take only the
// token from the payload and re-confirm the real status directly with
// PayDunya's API using our own private key. Only a "completed" result from
// that re-confirmation call ever grants Pro.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PAYDUNYA_MASTER_KEY = Deno.env.get('PAYDUNYA_MASTER_KEY')!;
const PAYDUNYA_PRIVATE_KEY = Deno.env.get('PAYDUNYA_PRIVATE_KEY')!;
const PAYDUNYA_PUBLIC_KEY = Deno.env.get('PAYDUNYA_PUBLIC_KEY')!;
const PAYDUNYA_TOKEN = Deno.env.get('PAYDUNYA_TOKEN')!;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function extractToken(body: any): string | undefined {
  return body?.data?.token ?? body?.data?.invoice?.token ?? body?.token;
}

Deno.serve(async (req: Request) => {
  try {
    const contentType = req.headers.get('content-type') ?? '';
    let token: string | undefined;

    if (contentType.includes('application/json')) {
      token = extractToken(await req.json());
    } else {
      const form = await req.formData();
      const raw = form.get('data');
      if (raw) {
        try { token = extractToken(JSON.parse(String(raw))); } catch { /* fall through */ }
      }
      token ??= (form.get('token') as string | null) ?? undefined;
    }
    if (!token) throw new Error('token manquant');

    // Re-confirm with PayDunya directly — the only source of truth here.
    const confirmRes = await fetch(`https://app.paydunya.com/api/v1/checkout-invoice/confirm/${token}`, {
      headers: {
        'PAYDUNYA-MASTER-KEY': PAYDUNYA_MASTER_KEY,
        'PAYDUNYA-PRIVATE-KEY': PAYDUNYA_PRIVATE_KEY,
        'PAYDUNYA-PUBLIC-KEY': PAYDUNYA_PUBLIC_KEY,
        'PAYDUNYA-TOKEN': PAYDUNYA_TOKEN,
      },
    });
    const confirm = await confirmRes.json();

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: payment } = await admin
      .from('pro_payments').select('*').eq('paydunya_token', token).single();
    if (!payment) throw new Error('Paiement introuvable');

    // Idempotent: PayDunya may call this more than once for the same invoice.
    if (payment.status === 'completed') {
      return new Response('ok', { status: 200 });
    }

    if (confirm.status === 'completed') {
      await admin.from('pro_payments')
        .update({ status: 'completed', confirmed_at: new Date().toISOString() })
        .eq('id', payment.id);
      // The only place in the codebase allowed to grant Pro — service-role
      // write, bypasses the trg_protect_provider_tier guard on `providers`.
      await admin.from('providers')
        .update({ tier: 'pro', pro_since: new Date().toISOString(), verified: true })
        .eq('id', payment.provider_id);
      // Only now — a genuinely confirmed payment — does a discount code
      // actually get consumed. An abandoned checkout never reaches here, so
      // it never burns a redemption slot.
      if (payment.discount_code_id) {
        await admin.from('discount_redemptions').insert({
          code_id: payment.discount_code_id, provider_id: payment.provider_id, user_id: payment.user_id,
          purpose: 'membership', amount_saved: payment.discount_amount,
        }).then(() => {}, () => {}); // ignore a duplicate-key error if this webhook somehow fires twice past the idempotency guard above
        const { data: codeRow } = await admin.from('discount_codes').select('redemption_count').eq('id', payment.discount_code_id).single();
        if (codeRow) {
          await admin.from('discount_codes').update({ redemption_count: codeRow.redemption_count + 1 }).eq('id', payment.discount_code_id);
        }
      }
    } else {
      await admin.from('pro_payments')
        .update({ status: confirm.status === 'cancelled' ? 'cancelled' : 'failed' })
        .eq('id', payment.id);
    }

    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response('error', { status: 400 });
  }
});
