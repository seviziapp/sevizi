// Sèvizi — books an appointment slot and, if the service requires a deposit,
// creates a PayDunya checkout invoice for it. The slot is re-validated
// server-side (never trust the client's "this slot is free" check) and the
// appointment row is inserted here with deposit_status='pending' — only
// paydunya-appointment-webhook can flip it to 'paid' after re-confirming
// with PayDunya. Services with no deposit skip PayDunya entirely and the
// appointment is confirmed immediately.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, createInvoice } from '../_shared/paydunya.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

    const { serviceId, startsAt, returnUrl, cancelUrl } = await req.json().catch(() => ({} as any));
    if (!serviceId || !startsAt) throw new Error('Service ou créneau manquant');

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: service, error: svcErr } = await admin
      .from('provider_services').select('id, provider_id, name, duration_minutes, price, deposit_amount, active')
      .eq('id', serviceId).single();
    if (svcErr || !service || !service.active) throw new Error('Service introuvable');

    const { data: providerRows } = await admin
      .from('providers').select('bookable').eq('id', service.provider_id).limit(1);
    if (!providerRows?.[0]?.bookable) throw new Error("Ce prestataire n'accepte pas les rendez-vous en ligne.");

    const start = new Date(startsAt);
    if (Number.isNaN(start.getTime()) || start.getTime() < Date.now()) throw new Error('Créneau invalide');
    const end = new Date(start.getTime() + service.duration_minutes * 60000);

    // Re-check the slot is actually free — overlap against any non-cancelled
    // appointment on this provider.
    const { data: clashes } = await admin
      .from('appointments')
      .select('id')
      .eq('provider_id', service.provider_id)
      .neq('status', 'cancelled')
      .lt('starts_at', end.toISOString())
      .gt('ends_at', start.toISOString());
    if (clashes && clashes.length > 0) throw new Error('Ce créneau vient d\'être réservé par quelqu\'un d\'autre.');

    const deposit = service.deposit_amount ?? 0;

    if (deposit <= 0) {
      const { data: appt, error: apptErr } = await admin.from('appointments').insert({
        provider_id: service.provider_id,
        client_id: user.id,
        service_id: service.id,
        service_name: service.name,
        price: service.price,
        duration_minutes: service.duration_minutes,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        status: 'confirmed',
        deposit_amount: 0,
        deposit_status: 'none',
        confirmed_at: new Date().toISOString(),
      }).select('id').single();
      if (apptErr) throw apptErr;
      return new Response(JSON.stringify({ appointmentId: appt.id, confirmed: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: appt, error: apptErr } = await admin.from('appointments').insert({
      provider_id: service.provider_id,
      client_id: user.id,
      service_id: service.id,
      service_name: service.name,
      price: service.price,
      duration_minutes: service.duration_minutes,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      status: 'confirmed',
      deposit_amount: deposit,
      deposit_status: 'pending',
    }).select('id').single();
    if (apptErr) throw apptErr;

    const callbackUrl = `${SUPABASE_URL}/functions/v1/paydunya-appointment-webhook`;

    let token: string, invoiceUrl: string;
    try {
      ({ token, invoiceUrl } = await createInvoice({
        totalAmount: deposit,
        description: `Acompte rendez-vous - ${service.name}`,
        callbackUrl, returnUrl, cancelUrl,
        customData: { appointment_id: appt.id, client_id: user.id, provider_id: service.provider_id },
        storeName: 'Sevizi',
      }));
    } catch (e) {
      // Roll back the pending appointment so the slot isn't held forever.
      await admin.from('appointments').delete().eq('id', appt.id);
      throw e;
    }

    await admin.from('appointments')
      .update({ paydunya_token: token, invoice_url: invoiceUrl })
      .eq('id', appt.id);

    return new Response(JSON.stringify({ appointmentId: appt.id, invoiceUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
