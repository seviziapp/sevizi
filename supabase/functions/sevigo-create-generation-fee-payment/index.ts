// Sèvi Go — creates a PayDunya checkout link for the business owner to pay
// the per-invoice generation fee (pay-as-you-go, or Starter/Growth once
// past the included count). The invoice stays 'pending_fee' — locked, not
// shown/shared/printed — until sevigo-generation-fee-webhook confirms
// payment and flips it to 'draft'. The fee amount is computed here from the
// plan + usage at call time, never trusted from the client.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, createInvoice } from '../_shared/paydunya.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Keep in sync with SEVIGO_PLANS in src/lib/sevigo/types.ts.
const PLAN_RULES: Record<string, { included: number | null; extraFee: number }> = {
  payg: { included: 0, extraFee: 500 },
  starter: { included: 15, extraFee: 500 },
  growth: { included: 50, extraFee: 350 },
  unlimited: { included: null, extraFee: 0 },
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

    const { invoiceId, returnUrl, cancelUrl } = await req.json().catch(() => ({} as any));
    if (!invoiceId) throw new Error('invoiceId manquant');

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: invoice, error: invErr } = await admin
      .from('sevigo_invoices').select('id, user_id, number, status').eq('id', invoiceId).single();
    if (invErr || !invoice) throw new Error('Facture introuvable');
    if (invoice.user_id !== user.id) throw new Error("Cette facture ne vous appartient pas");
    if (invoice.status !== 'pending_fee') throw new Error("Cette facture n'est pas en attente de frais.");

    // Re-derive the fee server-side — never trust a client-supplied amount.
    const { data: sub } = await admin
      .from('sevigo_subscriptions').select('plan_id, invoices_this_cycle').eq('user_id', user.id).maybeSingle();
    const planId = sub?.plan_id ?? 'payg';
    const rule = PLAN_RULES[planId] ?? PLAN_RULES.payg;
    // This invoice was already counted by trg_bump_sevigo_invoice_usage on
    // insert, so "before this one" is the current count minus 1.
    const usedBefore = Math.max(0, (sub?.invoices_this_cycle ?? 1) - 1);
    const fee = rule.included === null ? 0 : (usedBefore >= rule.included ? rule.extraFee : 0);
    if (fee <= 0) throw new Error('Aucun frais ne s\'applique à cette facture.');

    // Referral credit — capped at balance and what's owed. Not deducted from
    // the ledger yet; only actually spent once genuinely confirmed (right
    // below for a fully-covered checkout, or in sevigo-generation-fee-webhook).
    const { data: creditBalance } = await admin.rpc('referral_credit_balance', { p_user_id: user.id });
    const creditApplied = Math.min(creditBalance ?? 0, fee);
    const totalAmount = Math.max(0, fee - creditApplied);

    if (totalAmount <= 0) {
      await admin.from('sevigo_invoice_generation_fees').insert({
        invoice_id: invoice.id, user_id: user.id, amount: 0, status: 'completed',
        referral_credit_applied: creditApplied, confirmed_at: new Date().toISOString(),
      });
      await admin.from('sevigo_invoices').update({ status: 'draft' }).eq('id', invoice.id).eq('status', 'pending_fee');
      await admin.from('referral_credits').insert({
        user_id: user.id, amount: -creditApplied, kind: 'spend_sevigo_fee', note: `Frais de génération — Facture ${invoice.number}`,
      });
      return new Response(JSON.stringify({ confirmed: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const callbackUrl = `${SUPABASE_URL}/functions/v1/sevigo-generation-fee-webhook`;

    const { token, invoiceUrl } = await createInvoice({
      totalAmount,
      description: `Frais de génération — Facture ${invoice.number}`,
      callbackUrl, returnUrl, cancelUrl,
      customData: { sevigo_invoice_id: invoice.id, user_id: user.id, kind: 'generation_fee' },
      storeName: 'Sèvi Go',
    });

    await admin.from('sevigo_invoice_generation_fees').insert({
      invoice_id: invoice.id,
      user_id: user.id,
      amount: totalAmount,
      status: 'pending',
      paydunya_token: token,
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
