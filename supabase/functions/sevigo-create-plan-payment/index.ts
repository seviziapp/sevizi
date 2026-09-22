// Sèvi Go — creates a PayDunya checkout link for a paid plan's monthly fee
// (Starter/Growth/Unlimited). The plan does NOT change until
// sevigo-plan-payment-webhook confirms payment — switching to Pay As You Go
// (free) never goes through this function, see setSevigoPlan.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, createInvoice } from '../_shared/paydunya.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Keep in sync with SEVIGO_PLANS in src/lib/sevigo/types.ts.
const PLAN_FEES: Record<string, number> = { starter: 2000, growth: 5000, unlimited: 10000 };
const PLAN_LABELS: Record<string, string> = { starter: 'Starter', growth: 'Growth', unlimited: 'Unlimited' };

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

    const { planId, returnUrl, cancelUrl } = await req.json().catch(() => ({} as any));
    const fee = PLAN_FEES[planId];
    if (!fee) throw new Error('Formule invalide.');

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Referral credit — capped at balance and what's owed. Not deducted from
    // the ledger yet; only actually spent once genuinely confirmed (right
    // below for a fully-covered checkout, or in sevigo-plan-payment-webhook).
    const { data: creditBalance } = await admin.rpc('referral_credit_balance', { p_user_id: user.id });
    const creditApplied = Math.min(creditBalance ?? 0, fee);
    const totalAmount = Math.max(0, fee - creditApplied);

    if (totalAmount <= 0) {
      await admin.from('sevigo_plan_payments').insert({
        user_id: user.id, plan_id: planId, amount: 0, status: 'completed',
        referral_credit_applied: creditApplied, confirmed_at: new Date().toISOString(),
      });
      await admin.from('sevigo_subscriptions').upsert({ user_id: user.id, plan_id: planId }, { onConflict: 'user_id' });
      await admin.from('referral_credits').insert({
        user_id: user.id, amount: -creditApplied, kind: 'spend_sevigo_plan', note: `Formule Sèvi Go ${PLAN_LABELS[planId]}`,
      });
      return new Response(JSON.stringify({ confirmed: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const callbackUrl = `${SUPABASE_URL}/functions/v1/sevigo-plan-payment-webhook`;

    const { token, invoiceUrl } = await createInvoice({
      totalAmount,
      description: `Abonnement Sèvi Go ${PLAN_LABELS[planId]} — 1 mois`,
      callbackUrl, returnUrl, cancelUrl,
      customData: { user_id: user.id, plan_id: planId, kind: 'plan_payment' },
      storeName: 'Sèvi Go',
    });

    await admin.from('sevigo_plan_payments').insert({
      user_id: user.id, plan_id: planId, amount: totalAmount, status: 'pending', paydunya_token: token,
      referral_credit_applied: creditApplied,
    });

    return new Response(JSON.stringify({ invoiceUrl, fee: totalAmount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
