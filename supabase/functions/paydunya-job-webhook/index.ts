// Sèvizi — PayDunya IPN (webhook) for client -> provider job payments.
// Anonymous (verify_jwt OFF) — PayDunya calls this directly. We never trust
// the request body itself; we take only the token and re-confirm the real
// status with PayDunya's API using our own private key before marking
// anything as paid.
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
