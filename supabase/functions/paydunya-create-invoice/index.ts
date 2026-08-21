// Sèvizi — creates a PayDunya checkout invoice for the Sèvizi Pro monthly
// subscription (5,000 F). Called by the app with the caller's own JWT
// (verify_jwt is on for this function); the provider only becomes Pro once
// paydunya-webhook confirms the payment — this function never grants Pro
// itself, it only starts the checkout.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, createInvoice } from '../_shared/paydunya.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Keep in sync with src/lib/pricing.ts PRO_MONTHLY_FEE.
const PRO_MONTHLY_FEE = 5000;

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

    const { token, invoiceUrl } = await createInvoice({
      totalAmount,
      description: discountCodeId ? 'Abonnement Sèvizi Pro - 1 mois (code promo appliqué)' : 'Abonnement Sèvizi Pro - 1 mois',
      callbackUrl, returnUrl, cancelUrl,
      customData: { provider_id: provider.id, user_id: user.id },
    });

    await admin.from('pro_payments').insert({
      provider_id: provider.id,
      user_id: user.id,
      amount: totalAmount,
      status: 'pending',
      paydunya_token: token,
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
