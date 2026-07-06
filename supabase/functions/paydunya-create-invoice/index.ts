// Sèvizi — creates a PayDunya checkout invoice for the Sèvizi Pro monthly
// subscription (5,000 F). Called by the app with the caller's own JWT
// (verify_jwt is on for this function); the provider only becomes Pro once
// paydunya-webhook confirms the payment — this function never grants Pro
// itself, it only starts the checkout.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PAYDUNYA_MASTER_KEY = Deno.env.get('PAYDUNYA_MASTER_KEY')!;
const PAYDUNYA_PRIVATE_KEY = Deno.env.get('PAYDUNYA_PRIVATE_KEY')!;
const PAYDUNYA_PUBLIC_KEY = Deno.env.get('PAYDUNYA_PUBLIC_KEY')!;
const PAYDUNYA_TOKEN = Deno.env.get('PAYDUNYA_TOKEN')!;
// 'test' while integrating (PayDunya test API keys), 'live' once real keys
// are in use — see the PayDunya dashboard's "API keys" page for both sets.
const PAYDUNYA_MODE = Deno.env.get('PAYDUNYA_MODE') ?? 'live';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Keep in sync with src/lib/pricing.ts PRO_MONTHLY_FEE.
const PRO_MONTHLY_FEE = 5000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Non connecté');

    // Verify who's actually calling, using their own JWT.
    const caller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await caller.auth.getUser();
    if (userErr || !user) throw new Error('Non connecté');

    const { returnUrl, cancelUrl } = await req.json().catch(() => ({} as any));

    // Privileged client for the actual reads/writes below.
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: provider, error: provErr } = await admin
      .from('providers').select('id, tier').eq('user_id', user.id).single();
    if (provErr || !provider) throw new Error('Profil prestataire introuvable');
    if (provider.tier === 'pro') throw new Error('Vous êtes déjà abonné à Sèvizi Pro.');

    const callbackUrl = `${SUPABASE_URL}/functions/v1/paydunya-webhook`;

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
          total_amount: PRO_MONTHLY_FEE,
          description: 'Abonnement Sèvizi Pro - 1 mois',
        },
        store: { name: 'Sèvizi' },
        actions: {
          cancel_url: cancelUrl ?? 'https://sevizi.app',
          return_url: returnUrl ?? 'https://sevizi.app',
          callback_url: callbackUrl,
        },
        custom_data: { provider_id: provider.id, user_id: user.id },
      }),
    });
    const invoiceData = await invoiceRes.json();
    if (invoiceData.response_code !== '00' || !invoiceData.token) {
      throw new Error(invoiceData.response_text ?? "Échec de la création de la facture PayDunya.");
    }

    const invoiceUrl = `https://paydunya.com/checkout/invoice/${invoiceData.token}`;

    await admin.from('pro_payments').insert({
      provider_id: provider.id,
      user_id: user.id,
      amount: PRO_MONTHLY_FEE,
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
