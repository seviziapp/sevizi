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

    const { returnUrl, cancelUrl, discountCode } = await req.json().catch(() => ({} as any));

    // Privileged client for the actual reads/writes below.
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    // .limit(1) (not .single()) so a duplicate provider row doesn't throw and
    // get misread as "no provider" — matches fetchMyProviderProfile's pattern
    // in src/lib/api.ts.
    const { data: providerRows, error: provErr } = await admin
      .from('providers').select('id, tier').eq('user_id', user.id)
      .order('created_at', { ascending: true }).limit(1);
    const provider = providerRows?.[0];
    if (provErr || !provider) throw new Error('Profil prestataire introuvable');
    if (provider.tier === 'pro') throw new Error('Vous êtes déjà abonné à Sèvizi Pro.');

    // Validate the code (if any) through the SAME server-side logic used for
    // commission codes — reuses redeem_discount_code's checks (active, not
    // expired, applies_to, redemption cap, not already used by this
    // provider) without duplicating them here. Called with the caller's own
    // JWT (not admin) so auth.uid() resolves correctly inside the function.
    // Deliberately does NOT consume the redemption yet — that only happens
    // in paydunya-webhook once the payment is actually confirmed, so an
    // abandoned checkout doesn't burn a redemption slot.
    let discountCodeId: string | null = null;
    let discountAmount = 0;
    let totalAmount = PRO_MONTHLY_FEE;
    if (discountCode) {
      const { data: redemption, error: redeemErr } = await caller.rpc('redeem_discount_code', {
        p_code: discountCode, p_purpose: 'membership',
      });
      if (redeemErr) throw new Error(redeemErr.message);
      discountCodeId = redemption.codeId;
      discountAmount = redemption.kind === 'percent'
        ? Math.round(PRO_MONTHLY_FEE * (redemption.value / 100))
        : redemption.value;
      totalAmount = Math.max(0, PRO_MONTHLY_FEE - discountAmount);
    }

    // A 100%-off code needs no PayDunya round-trip — PayDunya doesn't accept
    // a 0-amount invoice anyway. Grant Pro immediately and record the
    // redemption right here (this IS the confirmation; there's no payment to
    // wait on).
    if (discountCodeId && totalAmount <= 0) {
      await admin.from('pro_payments').insert({
        provider_id: provider.id, user_id: user.id, amount: 0, status: 'completed',
        discount_code_id: discountCodeId, discount_amount: discountAmount,
        confirmed_at: new Date().toISOString(),
      });
      await admin.from('providers')
        .update({ tier: 'pro', pro_since: new Date().toISOString(), verified: true })
        .eq('id', provider.id);
      await admin.from('discount_redemptions').insert({
        code_id: discountCodeId, provider_id: provider.id, user_id: user.id,
        purpose: 'membership', amount_saved: discountAmount,
      });
      const { data: codeRow } = await admin.from('discount_codes').select('redemption_count').eq('id', discountCodeId).single();
      await admin.from('discount_codes').update({ redemption_count: (codeRow?.redemption_count ?? 0) + 1 }).eq('id', discountCodeId);
      return new Response(JSON.stringify({ confirmed: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
          total_amount: totalAmount,
          description: discountCodeId ? 'Abonnement Sèvizi Pro - 1 mois (code promo appliqué)' : 'Abonnement Sèvizi Pro - 1 mois',
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
      amount: totalAmount,
      status: 'pending',
      paydunya_token: invoiceData.token,
      invoice_url: invoiceUrl,
      discount_code_id: discountCodeId,
      discount_amount: discountAmount,
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
