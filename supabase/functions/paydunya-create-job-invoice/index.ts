// Sèvizi — creates a PayDunya checkout invoice so a client can pay for a
// job for real (mobile money or card — no cash). Sèvizi collects the full
// amount; the provider's net share (after commission) is computed and
// recorded here, but remitting it to the provider is currently a manual/
// business-side step (see supabase/migration_paydunya_job_payments.sql).
// This function never marks the job as paid itself — only
// paydunya-job-webhook does, after re-confirming with PayDunya.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PAYDUNYA_MASTER_KEY = Deno.env.get('PAYDUNYA_MASTER_KEY')!;
const PAYDUNYA_PRIVATE_KEY = Deno.env.get('PAYDUNYA_PRIVATE_KEY')!;
const PAYDUNYA_PUBLIC_KEY = Deno.env.get('PAYDUNYA_PUBLIC_KEY')!;
const PAYDUNYA_TOKEN = Deno.env.get('PAYDUNYA_TOKEN')!;
const PAYDUNYA_MODE = Deno.env.get('PAYDUNYA_MODE') ?? 'live';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Keep in sync with src/lib/pricing.ts.
const COMMISSION_RATE = 0.10;
const COMMISSION_RATE_PRO = 0.07;
// Promo: zero commission for every provider until this date — keep in sync
// with COMMISSION_FREE_UNTIL in src/lib/pricing.ts.
const COMMISSION_FREE_UNTIL = new Date('2027-01-04T00:00:00Z');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Non connecté');

    const caller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await caller.auth.getUser();
    if (userErr || !user) throw new Error('Non connecté');

    const { jobId, returnUrl, cancelUrl } = await req.json().catch(() => ({} as any));
    if (!jobId) throw new Error('jobId manquant');

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: job, error: jobErr } = await admin
      .from('jobs').select('id, price, client_id, provider_id, payment_status').eq('id', jobId).single();
    if (jobErr || !job) throw new Error('Mission introuvable');
    if (job.client_id !== user.id) throw new Error('Cette mission ne vous appartient pas');
    if (job.payment_status === 'paid') throw new Error('Cette mission est déjà payée.');

    const { data: providerRows } = await admin
      .from('providers').select('tier, commission_discount_pct, commission_discount_until').eq('id', job.provider_id).limit(1);
    const providerRow = providerRows?.[0];
    const tier = providerRow?.tier ?? 'free';
    const isFreePeriod = Date.now() < COMMISSION_FREE_UNTIL.getTime();
    let rate = isFreePeriod ? 0 : (tier === 'pro' ? COMMISSION_RATE_PRO : COMMISSION_RATE);
    // Admin-granted commission discount (redeemed discount code) — a
    // percentage taken OFF the normal rate, only while still active.
    const discountPct = providerRow?.commission_discount_pct ?? 0;
    const discountUntil = providerRow?.commission_discount_until;
    const discountActive = discountPct > 0 && (!discountUntil || new Date(discountUntil).getTime() > Date.now());
    if (discountActive) rate = rate * (1 - discountPct / 100);
    const commission = Math.round(job.price * rate);
    const netAmount = job.price - commission;

    const callbackUrl = `${SUPABASE_URL}/functions/v1/paydunya-job-webhook`;

    const invoiceRes = await fetch('https://app.paydunya.com/api/v1/checkout-invoice/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PAYDUNYA-MASTER-KEY': PAYDUNYA_MASTER_KEY,
        'PAYDUNYA-PRIVATE-KEY': PAYDUNYA_PRIVATE_KEY,
        'PAYDUNYA-PUBLIC-KEY': PAYDUNYA_PUBLIC_KEY,
        'PAYDUNYA-TOKEN': PAYDUNYA_TOKEN,
      },
      body: JSON.stringify({
        mode: PAYDUNYA_MODE,
        invoice: {
          total_amount: job.price,
          description: 'Paiement mission Sevizi',
        },
        store: { name: 'Sevizi' },
        actions: {
          cancel_url: cancelUrl ?? 'https://sevizi.app',
          return_url: returnUrl ?? 'https://sevizi.app',
          callback_url: callbackUrl,
        },
        custom_data: { job_id: job.id, client_id: user.id, provider_id: job.provider_id },
      }),
    });
    const invoiceData = await invoiceRes.json();
    if (invoiceData.response_code !== '00' || !invoiceData.token) {
      throw new Error(invoiceData.response_text ?? "Échec de la création de la facture PayDunya.");
    }

    const invoiceUrl = `https://paydunya.com/checkout/invoice/${invoiceData.token}`;

    await admin.from('job_payments').insert({
      job_id: job.id,
      client_id: user.id,
      provider_id: job.provider_id,
      amount: job.price,
      commission,
      net_amount: netAmount,
      status: 'pending',
      paydunya_token: invoiceData.token,
      invoice_url: invoiceUrl,
    });

    return new Response(JSON.stringify({ invoiceUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
