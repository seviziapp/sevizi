// Sèvi Go — creates a PayDunya checkout link for an invoice so the client
// can pay directly (mobile money or card). Sèvi Go's cut (plan-tier fee,
// see SEVIGO_PLANS in src/lib/sevigo/types.ts) is computed and recorded
// here for later payout accounting; this function never marks the invoice
// paid itself — only sevigo-invoice-webhook does, after re-confirming with
// PayDunya.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, createInvoice } from '../_shared/paydunya.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Keep in sync with SEVIGO_PLANS in src/lib/sevigo/types.ts.
const PAYDUNYA_FEE_PCT: Record<string, number> = {
  payg: 0.10, starter: 0.10, growth: 0.07, unlimited: 0.05,
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
      .from('sevigo_invoices').select('id, user_id, number, total, status').eq('id', invoiceId).single();
    if (invErr || !invoice) throw new Error('Facture introuvable');
    if (invoice.user_id !== user.id) throw new Error("Cette facture ne vous appartient pas");
    if (invoice.status === 'paid') throw new Error('Cette facture est déjà payée.');
    if (invoice.total <= 0) throw new Error('Montant de facture invalide.');

    const { data: sub } = await admin
      .from('sevigo_subscriptions').select('plan_id').eq('user_id', user.id).maybeSingle();
    const planId = sub?.plan_id ?? 'payg';
    const feePct = PAYDUNYA_FEE_PCT[planId] ?? PAYDUNYA_FEE_PCT.payg;
    const sevigoFee = Math.round(invoice.total * feePct);

    const callbackUrl = `${SUPABASE_URL}/functions/v1/sevigo-invoice-webhook`;

    const { token, invoiceUrl } = await createInvoice({
      totalAmount: invoice.total,
      description: `Facture ${invoice.number} — Sèvi Go`,
      callbackUrl, returnUrl, cancelUrl,
      customData: { sevigo_invoice_id: invoice.id, user_id: user.id },
      storeName: 'Sèvi Go',
    });

    await admin.from('sevigo_invoices')
      .update({ paydunya_token: token, payment_url: invoiceUrl })
      .eq('id', invoice.id);

    await admin.from('sevigo_invoice_payments').insert({
      invoice_id: invoice.id,
      user_id: user.id,
      amount: invoice.total,
      sevigo_fee: sevigoFee,
      net_amount: invoice.total - sevigoFee,
      status: 'pending',
      paydunya_token: token,
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
