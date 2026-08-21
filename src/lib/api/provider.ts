// Sèvizi — provider-facing API: Sèvizi Pro subscription checkout, stats,
// browsing/bidding on requests, and the wallet/withdrawal flow. Split out
// of the former monolithic api.ts (Phase 1); every function body is
// unchanged.
import { supabase } from '../supabase';
import { ServiceCategory, GeoPoint, ServiceRequest, WithdrawalRequest, ProviderStats } from '../types';
import { LOME, hasSupabase, currentUser } from './shared';

// Starts a real PayDunya checkout for the Sèvizi Pro monthly subscription.
// Returns the hosted checkout page URL to open (mobile money / card) — the
// provider is only actually flipped to Pro once PayDunya confirms payment
// and the paydunya-webhook Edge Function processes it (see
// supabase/migration_paydunya.sql for why this can't happen client-side).
export async function createProSubscriptionInvoice(returnUrl: string, cancelUrl: string, discountCode?: string): Promise<{ invoiceUrl: string }> {
  if (!hasSupabase) throw new Error('Paiement indisponible en mode démo');
  const { data, error } = await supabase.functions.invoke('paydunya-create-invoice', {
    body: { returnUrl, cancelUrl, discountCode: discountCode?.trim() || undefined },
  });
  if (error) {
    // On a non-2xx response, supabase-js only gives a generic "Edge Function
    // returned a non-2xx status code" — the real reason is in the response
    // body (context), which we set ourselves in the function's catch block.
    const context = (error as any)?.context;
    let bodyMessage: string | undefined;
    if (context && typeof context.json === 'function') {
      try {
        const body = await context.json();
        bodyMessage = body?.error;
      } catch { /* body wasn't JSON — fall through to the generic error */ }
    }
    throw new Error(bodyMessage ?? error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

// Latest Pro payment attempt for the current provider, for the upgrade
// screen to show "vérification du paiement…" after returning from checkout.
export async function fetchLatestProPayment(): Promise<{ status: string } | null> {
  if (!hasSupabase) return null;
  const user = await currentUser();
  if (!user) return null;
  const { data } = await supabase
    .from('pro_payments').select('status').eq('user_id', user.id)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  return data ?? null;
}

export async function fetchProviderStats(): Promise<ProviderStats> {
  const empty: ProviderStats = { openRequests: 0, sentOffers: 0, completedJobs: 0, rating: 0, earnings: 0, responseRate: 0 };
  if (!hasSupabase) return empty;
  const user = await currentUser();
  if (!user) return empty;
  const { data: provider } = await supabase.from('providers').select('id, rating').eq('user_id', user.id).single();
  if (!provider) return empty;
  const [openReqs, sentOffers, acceptedJobs, completedJobs, earnings] = await Promise.all([
    supabase.from('requests').select('id', { count: 'exact', head: true }).eq('status', 'ouverte'),
    supabase.from('offers').select('id', { count: 'exact', head: true }).eq('provider_id', provider.id),
    supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('provider_id', provider.id),
    supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('provider_id', provider.id).eq('status', 'termine'),
    supabase.from('jobs').select('price').eq('provider_id', provider.id).eq('status', 'termine'),
  ]);
  const offers = sentOffers.count ?? 0;
  const accepted = acceptedJobs.count ?? 0;
  const totalEarnings = (earnings.data ?? []).reduce((sum: number, j: any) => sum + (j.price ?? 0), 0);
  // "Taux de réponse" = how many of the provider's offers get accepted.
  const responseRate = offers > 0 ? Math.min(100, Math.round((accepted / offers) * 100)) : 0;
  // Persist so the public profile shows the same figure.
  supabase.from('providers').update({ response_rate: responseRate }).eq('id', provider.id).then(() => {}, () => {});
  return {
    openRequests: openReqs.count ?? 0,
    sentOffers: offers,
    completedJobs: completedJobs.count ?? 0,
    rating: provider.rating ?? 0,
    earnings: totalEarnings,
    responseRate,
  };
}

// `center` should be the caller's real location (see resolveMyLocation) so a
// provider sees requests actually near them instead of always around LOME.
export async function fetchNearbyRequests(category?: ServiceCategory, center?: GeoPoint, radiusKm = 30): Promise<ServiceRequest[]> {
  if (!hasSupabase) return [];
  const anchor = center ?? LOME;
  // Prefer the RPC — it returns real lat/lng (for the map) + offer counts.
  const { data, error } = await supabase.rpc('nearby_requests', {
    lat: anchor.lat, lng: anchor.lng, cat: category ?? null, radius_km: radiusKm,
  });
  if (!error && data) {
    return (data as any[]).map(r => ({
      id: r.id, clientId: '', description: r.description, category: r.category,
      urgent: r.urgent, locationLabel: r.location_label, createdAt: r.created_at,
      status: r.status, offersCount: Number(r.offers_count ?? 0),
      location: { lat: r.lat, lng: r.lng },
      distanceKm: r.distance_km != null ? Number(r.distance_km) : undefined,
    }));
  }
  // Fallback: plain select (no coordinates)
  let q = supabase.from('requests').select('*').eq('status', 'ouverte').order('created_at', { ascending: false });
  if (category) q = q.eq('category', category);
  const { data: d2 } = await q;
  return (d2 ?? []).map((r: any) => ({
    id: r.id, clientId: r.client_id, description: r.description, category: r.category,
    urgent: r.urgent, locationLabel: r.location_label, createdAt: r.created_at,
    status: r.status, offersCount: 0, location: anchor,
  }));
}

export async function sendOffer(input: { requestId: string; price: number; availability: string; message?: string; visitRequired?: boolean; priceMax?: number }): Promise<void> {
  if (!hasSupabase) return;
  const user = await currentUser();
  if (!user) throw new Error('Non connecté');
  const { data: providerData } = await supabase.from('providers').select('id').eq('user_id', user.id).single();
  if (!providerData) throw new Error('Profil prestataire introuvable');
  const { error } = await supabase.from('offers').insert({
    request_id: input.requestId, provider_id: providerData.id,
    price: input.price, availability: input.availability, message: input.message,
    visit_required: input.visitRequired ?? false,
    price_max: input.visitRequired ? (input.priceMax ?? null) : null,
  });
  if (error) throw error;
}

export async function toggleOnline(online: boolean): Promise<void> {
  if (!hasSupabase) return;
  const user = await currentUser();
  if (!user) return;
  const { error } = await supabase.from('providers').update({ online }).eq('user_id', user.id);
  if (error) throw error;
}

// ---- Provider wallet / withdrawal requests ----

// Withdrawable balance: net earnings from completed job payments, minus
// anything already requested (pending or sent) — see
// supabase/migration_withdrawals.sql's provider_wallet_balance().
export async function fetchWalletBalance(): Promise<number> {
  if (!hasSupabase) return 0;
  const user = await currentUser();
  if (!user) return 0;
  const { data: providerRows } = await supabase.from('providers').select('id').eq('user_id', user.id).limit(1);
  const providerId = providerRows?.[0]?.id;
  if (!providerId) return 0;
  const { data, error } = await supabase.rpc('provider_wallet_balance', { p_provider_id: providerId });
  if (error) return 0;
  return data ?? 0;
}

export async function requestWithdrawal(input: { amount: number; method: 'flooz' | 'mixx'; phone: string }): Promise<void> {
  if (!hasSupabase) return;
  const user = await currentUser();
  if (!user) throw new Error('Non connecté');
  const { data: providerRows } = await supabase.from('providers').select('id').eq('user_id', user.id).limit(1);
  const providerId = providerRows?.[0]?.id;
  if (!providerId) throw new Error('Profil prestataire introuvable');
  const { error } = await supabase.from('withdrawal_requests').insert({
    provider_id: providerId, user_id: user.id,
    amount: input.amount, method: input.method, phone: input.phone,
  });
  if (error) throw error;
}

export async function fetchMyWithdrawalRequests(): Promise<WithdrawalRequest[]> {
  if (!hasSupabase) return [];
  const user = await currentUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('withdrawal_requests').select('*').eq('user_id', user.id)
    .order('requested_at', { ascending: false });
  if (error) return [];
  return (data ?? []).map((w: any) => ({
    id: w.id, providerName: '', amount: w.amount, method: w.method, phone: w.phone,
    status: w.status, requestedAt: w.requested_at, resolvedAt: w.resolved_at ?? undefined,
  }));
}
