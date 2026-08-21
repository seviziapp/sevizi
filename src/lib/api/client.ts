// Sèvizi — client-facing API: browsing providers, posting/tracking requests,
// offers, jobs, messaging, favorites, notifications. Split out of the
// former monolithic api.ts (Phase 1); every function body is unchanged.
import { supabase } from '../supabase';
import {
  Provider, ServiceRequest, Offer, ServiceCategory, GeoPoint, Job, Notification, Review,
} from '../types';
import {
  LOME, hasSupabase, currentUser, byTierThenDistance,
  mockProviders, mockRequests, mockOffers,
} from './shared';

// `center` should be the caller's real location (see resolveMyLocation) so
// distanceKm and the "nearby" set actually reflect where the user is, instead
// of always the fixed LOME city anchor.
export async function fetchNearbyProviders(category?: ServiceCategory, center?: GeoPoint, radiusKm = 20): Promise<Provider[]> {
  if (!hasSupabase) return [];
  const anchor = center ?? LOME;
  const { data, error } = await supabase.rpc('nearby_providers', {
    lat: anchor.lat, lng: anchor.lng, cat: category ?? null, radius_km: radiusKm,
  });
  if (error) {
    // fallback to simple select if RPC fails
    let q = supabase.from('providers').select('*').eq('online', true);
    if (category) q = q.eq('category', category);
    const { data: d2, error: e2 } = await q;
    if (e2) throw e2;
    return (d2 ?? []).map((p: any) => ({
      id: p.id, name: p.name, category: p.category, rating: p.rating,
      reviews: p.reviews, verified: p.verified, online: p.online,
      missions: p.missions, yearsActive: p.years_active, responseRate: p.response_rate,
      bio: p.bio, distanceKm: 0, location: anchor,
      tier: p.tier ?? 'free', categories: p.categories ?? [],
    })).sort(byTierThenDistance);
  }
  return (data ?? []).map((p: any) => ({
    id: p.id, name: p.name, category: p.category, rating: p.rating,
    reviews: p.reviews, verified: p.verified, online: p.online,
    missions: p.missions, yearsActive: p.years_active, responseRate: p.response_rate,
    bio: p.bio, distanceKm: p.distance_km ?? 0,
    location: { lat: p.lat, lng: p.lng },
    tier: p.tier ?? 'free', categories: p.categories ?? [],
  })).sort(byTierThenDistance);
}

export async function fetchProvider(id: string): Promise<Provider> {
  if (!hasSupabase) {
    return mockProviders.find(p => p.id === id) ?? mockProviders[0];
  }
  const { data, error } = await supabase.from('providers').select('*').eq('id', id).single();
  if (error) throw error;
  return {
    id: data.id, name: data.name, category: data.category,
    rating: data.rating ?? 0, reviews: data.reviews ?? 0,
    verified: !!data.verified, online: !!data.online,
    missions: data.missions ?? 0, yearsActive: data.years_active ?? 0,
    responseRate: data.response_rate ?? 0, bio: data.bio ?? undefined,
    gallery: data.gallery ?? [], distanceKm: 0, location: LOME,
    tier: data.tier ?? 'free', categories: data.categories ?? [],
    bookable: !!data.bookable,
  };
}

// Count of completed missions for a provider (real "past missions").
export async function fetchProviderCompletedCount(providerId: string): Promise<number> {
  if (!hasSupabase) return 0;
  const { count } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('provider_id', providerId)
    .eq('status', 'termine');
  return count ?? 0;
}

export async function fetchProviderReviews(providerId: string): Promise<Review[]> {
  if (!hasSupabase) return [];
  const { data, error } = await supabase.from('reviews').select('*').eq('provider_id', providerId).order('created_at', { ascending: false });
  if (error) return [];
  return (data ?? []).map((r: any) => ({
    id: r.id,
    authorName: r.author_name ?? 'Client',
    rating: r.rating,
    comment: r.comment ?? '',
    createdAt: r.created_at,
  }));
}

// Client leaves a review after a completed mission. A DB trigger then
// recomputes the provider's average rating and notifies them.
export async function submitReview(input: { jobId: string; providerId: string; rating: number; comment?: string }): Promise<void> {
  if (!hasSupabase) return;
  const user = await currentUser();
  if (!user) throw new Error('Non connecté');
  const { data: me } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
  const { error } = await supabase.from('reviews').insert({
    job_id: input.jobId,
    provider_id: input.providerId,
    author_id: user.id,
    author_name: me?.full_name ?? 'Client',
    rating: input.rating,
    comment: input.comment?.trim() || null,
  });
  if (error) throw error;
}

// Whether the current user already reviewed a given job.
export async function hasReviewedJob(jobId: string): Promise<boolean> {
  if (!hasSupabase) return false;
  const { data } = await supabase.from('reviews').select('id').eq('job_id', jobId).maybeSingle();
  return !!data;
}

export async function createRequest(
  input: Omit<ServiceRequest, 'id' | 'createdAt' | 'status' | 'clientId' | 'offersCount'>
): Promise<ServiceRequest> {
  if (!hasSupabase) {
    return { ...input, id: 'r1', clientId: 'me', createdAt: new Date().toISOString(), status: 'ouverte', offersCount: 0 };
  }
  const user = await currentUser();
  if (!user) throw new Error('Non connecté');
  const { data, error } = await supabase
    .from('requests')
    .insert({
      client_id: user.id,
      description: input.description,
      category: input.category,
      urgent: input.urgent,
      geo: `POINT(${input.location.lng} ${input.location.lat})`,
      location_label: input.locationLabel,
    })
    .select().single();
  if (error) throw error;
  return { ...data, clientId: data.client_id, createdAt: data.created_at, locationLabel: data.location_label, offersCount: 0, location: input.location } as unknown as ServiceRequest;
}

export async function fetchMyRequests(): Promise<ServiceRequest[]> {
  if (!hasSupabase) return mockRequests.filter(r => r.clientId === 'me');
  const user = await currentUser();
  if (!user) return [];
  const { data, error } = await supabase.from('requests').select('*').eq('client_id', user.id).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ServiceRequest[];
}

export async function fetchOffers(requestId: string): Promise<Offer[]> {
  if (!hasSupabase) return mockOffers;
  const { data, error } = await supabase
    .from('offers')
    .select('*, provider:providers(*)')
    .eq('request_id', requestId)
    .order('price');
  if (error) throw error;
  return (data ?? []).map((o: any) => ({
    id: o.id,
    requestId: o.request_id,
    price: o.price,
    availability: o.availability ?? '',
    message: o.message ?? undefined,
    visitRequired: !!o.visit_required,
    priceMax: o.price_max ?? undefined,
    provider: {
      id: o.provider?.id, name: o.provider?.name ?? 'Prestataire', category: o.provider?.category,
      rating: o.provider?.rating ?? 0, reviews: o.provider?.reviews ?? 0,
      verified: !!o.provider?.verified, online: !!o.provider?.online,
      distanceKm: 0, location: LOME,
      tier: o.provider?.tier ?? 'free', categories: o.provider?.categories ?? [],
    },
  })) as unknown as Offer[];
}

// A single request (for the offers screen header / status).
export async function fetchRequest(requestId: string): Promise<ServiceRequest | null> {
  if (!hasSupabase) return mockRequests.find(r => r.id === requestId) ?? null;
  const { data } = await supabase.from('requests').select('*').eq('id', requestId).single();
  if (!data) return null;
  return {
    id: data.id, clientId: data.client_id, description: data.description, category: data.category,
    urgent: data.urgent, locationLabel: data.location_label, createdAt: data.created_at,
    status: data.status, location: LOME,
  };
}

// The client's own requests, with how many offers each has received.
export async function fetchMyRequestsWithOffers(): Promise<(ServiceRequest & { offersCount: number })[]> {
  if (!hasSupabase) return [];
  const user = await currentUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('requests')
    .select('*, offers(count)')
    .eq('client_id', user.id)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data ?? []).map((r: any) => ({
    id: r.id, clientId: r.client_id, description: r.description, category: r.category,
    urgent: r.urgent, locationLabel: r.location_label, createdAt: r.created_at,
    status: r.status, location: LOME,
    offersCount: r.offers?.[0]?.count ?? 0,
  }));
}

// Client accepts an offer: marks it accepted, creates the job, moves the request
// to "en_cours". A DB trigger then notifies the provider. Returns the new job id.
export async function acceptOffer(offerId: string): Promise<{ jobId: string; price: number; providerName: string }> {
  if (!hasSupabase) return { jobId: 'j1', price: 0, providerName: 'Prestataire' };
  const user = await currentUser();
  if (!user) throw new Error('Non connecté');

  const { data: offer, error: oErr } = await supabase
    .from('offers')
    .select('id, price, request_id, provider_id, request:requests(client_id), provider:providers(name)')
    .eq('id', offerId)
    .single();
  if (oErr || !offer) throw new Error('Offre introuvable');

  // The client may read their own profile, so capture name/phone here and store
  // them on the job — the provider can't read the client's profile directly.
  const { data: me } = await supabase.from('profiles').select('full_name, phone').eq('id', user.id).single();

  await supabase.from('offers').update({ accepted: true }).eq('id', offerId);

  const { data: job, error: jErr } = await supabase
    .from('jobs')
    .insert({
      offer_id: offer.id,
      request_id: offer.request_id,
      provider_id: offer.provider_id,
      client_id: (offer as any).request?.client_id,
      price: offer.price,
      status: 'accepte',
      client_name: me?.full_name ?? null,
      client_phone: me?.phone ?? null,
    })
    .select('id')
    .single();
  if (jErr) throw jErr;

  await supabase.from('requests').update({ status: 'en_cours' }).eq('id', offer.request_id);

  return { jobId: job.id, price: offer.price, providerName: (offer as any).provider?.name ?? 'Prestataire' };
}

// Starts a real PayDunya checkout for a job's full price — Sèvizi collects
// no cash; the job is only marked paid once paydunya-job-webhook confirms
// payment with PayDunya directly (see
// supabase/migration_paydunya_job_payments.sql for why this can't happen
// client-side).
export async function createJobPaymentInvoice(jobId: string, returnUrl: string, cancelUrl: string): Promise<{ invoiceUrl: string }> {
  if (!hasSupabase) throw new Error('Paiement indisponible en mode démo');
  const { data, error } = await supabase.functions.invoke('paydunya-create-job-invoice', {
    body: { jobId, returnUrl, cancelUrl },
  });
  if (error) {
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

// For the payment screen to poll after returning from PayDunya's checkout
// (the webhook confirmation is async).
export async function fetchJobPaymentStatus(jobId: string): Promise<'pending' | 'paid' | 'failed'> {
  if (!hasSupabase) return 'pending';
  const { data } = await supabase.from('jobs').select('payment_status').eq('id', jobId).single();
  return (data?.payment_status as any) ?? 'pending';
}

export async function fetchNotifications(): Promise<Notification[]> {
  if (!hasSupabase) return [];
  const user = await currentUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data ?? []).map((n: any) => ({
    id: n.id, type: n.type, title: n.title, body: n.body,
    read: n.read, createdAt: n.created_at, actionRoute: n.action_route,
  }));
}

export async function markAllNotificationsRead(): Promise<void> {
  if (!hasSupabase) return;
  const user = await currentUser();
  if (!user) return;
  await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
}

// The current job for either party — a client sees the job on their request, a
// provider sees the job assigned to their provider profile. By default excludes
// finished missions; pass { includeCompleted: true } for the review flow.
export async function fetchCurrentJob(opts?: { includeCompleted?: boolean }): Promise<Job | null> {
  if (!hasSupabase) return null;
  const user = await currentUser();
  if (!user) return null;

  // Is this user a provider? If so, also match jobs on their provider profile.
  const { data: prov } = await supabase.from('providers').select('id').eq('user_id', user.id).maybeSingle();

  // Explicit column list — deliberately excludes client_phone. Neither party's
  // app should ever receive the other's raw phone number over the wire, not
  // just hide it in the UI (a Postgres-level column grant backs this up too;
  // see migration_no_contact_sharing.sql).
  let q = supabase
    .from('jobs')
    .select('id, request_id, provider_id, client_id, price, status, accepted_at, client_name, provider:providers(*), request:requests(description, location_label)')
    .order('accepted_at', { ascending: false })
    .limit(1);

  if (!opts?.includeCompleted) q = q.not('status', 'eq', 'termine');

  q = prov?.id
    ? q.or(`client_id.eq.${user.id},provider_id.eq.${prov.id}`)
    : q.eq('client_id', user.id);

  const { data, error } = await q.maybeSingle();
  if (error || !data) return null;

  const p: any = (data as any).provider;
  const provider: Provider | undefined = p ? {
    id: p.id, name: p.name ?? 'Prestataire', category: p.category,
    rating: p.rating ?? 0, reviews: p.reviews ?? 0,
    verified: !!p.verified, online: !!p.online,
    missions: p.missions, yearsActive: p.years_active, responseRate: p.response_rate,
    bio: p.bio, distanceKm: 0, location: LOME,
  } : undefined;

  return {
    id: data.id, requestId: data.request_id, price: data.price,
    status: data.status, acceptedAt: data.accepted_at,
    provider,
    clientName: data.client_name ?? 'Client',
    // Deliberately not returning client_phone here: client and provider must
    // stay in-app (messaging only). It's still stored on the job (written in
    // acceptOffer below) for our own support/dispute use, just never sent to
    // the other party's app.
    description: (data as any).request?.description ?? '',
    locationLabel: (data as any).request?.location_label ?? '',
    location: LOME,
  };
}

export async function updateJobStatus(jobId: string, status: Job['status']): Promise<void> {
  if (!hasSupabase) return;
  const { data, error } = await supabase.from('jobs').update({ status }).eq('id', jobId).select('id');
  if (error) throw new Error(error.message);
  // RLS can silently match zero rows — surface that instead of pretending success.
  if (!data || data.length === 0) {
    throw new Error("Impossible de mettre à jour la mission (accès refusé). Reconnectez-vous et réessayez.");
  }
}

export async function fetchFavorites(): Promise<Provider[]> {
  if (!hasSupabase) return [mockProviders[0], mockProviders[4]];
  const user = await currentUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('favorites')
    .select('provider:providers(*)')
    .eq('user_id', user.id);
  if (error) return [];
  return (data ?? []).map((f: any) => ({
    ...f.provider,
    distanceKm: 0, location: LOME,
    yearsActive: f.provider.years_active,
    responseRate: f.provider.response_rate,
  }));
}

// ---- FAVORITES ----

export async function addFavorite(providerId: string): Promise<void> {
  if (!hasSupabase) return;
  const user = await currentUser();
  if (!user) return;
  await supabase.from('favorites').upsert({ user_id: user.id, provider_id: providerId });
}

export async function removeFavorite(providerId: string): Promise<void> {
  if (!hasSupabase) return;
  const user = await currentUser();
  if (!user) return;
  await supabase.from('favorites').delete().eq('user_id', user.id).eq('provider_id', providerId);
}

export async function isFavorite(providerId: string): Promise<boolean> {
  if (!hasSupabase) return false;
  const user = await currentUser();
  if (!user) return false;
  const { data } = await supabase.from('favorites').select('id').eq('user_id', user.id).eq('provider_id', providerId).single();
  return !!data;
}

// ---- MESSAGES ----

// Each of the user's missions is a conversation thread (keyed by request), with
// the other party's name and the latest message preview.
export async function fetchThreads(): Promise<
  { id: string; providerName: string; lastMessage: string; lastMessageAt: string | null; unreadCount: number }[]
> {
  if (!hasSupabase) return [];
  const user = await currentUser();
  if (!user) return [];
  const { data: prov } = await supabase.from('providers').select('id').eq('user_id', user.id).maybeSingle();

  let jq = supabase.from('jobs').select('request_id, client_id, provider_id, client_name, provider:providers(name)');
  jq = prov?.id ? jq.or(`client_id.eq.${user.id},provider_id.eq.${prov.id}`) : jq.eq('client_id', user.id);
  const { data: jobs, error } = await jq;
  if (error || !jobs) return [];

  const threads = await Promise.all(jobs.map(async (j: any) => {
    const { data: last } = await supabase
      .from('messages').select('body, created_at')
      .eq('request_id', j.request_id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    const isClient = j.client_id === user.id;
    return {
      id: j.request_id,
      providerName: isClient ? (j.provider?.name ?? 'Prestataire') : (j.client_name ?? 'Client'),
      lastMessage: last?.body ?? '',
      lastMessageAt: last?.created_at ?? null,
      unreadCount: 0,
    };
  }));

  return threads.sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''));
}

export async function fetchMessages(requestId: string): Promise<{ id: string; fromMe: boolean; text: string; createdAt: string }[]> {
  if (!hasSupabase) return [];
  const user = await currentUser();
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('request_id', requestId)
    .order('created_at', { ascending: true });
  if (error) return [];
  return (data ?? []).map((m: any) => ({
    id: m.id,
    fromMe: m.sender_id === user?.id,
    text: m.body ?? '',
    createdAt: m.created_at,
  }));
}

// Resolve the request thread for the current user's active/most-recent job,
// so messaging works even when a thread is opened without an explicit id.
export async function resolveActiveThread(): Promise<{ requestId: string; otherName: string } | null> {
  const job = await fetchCurrentJob({ includeCompleted: true });
  if (!job) return null;
  return { requestId: job.requestId, otherName: job.provider?.name ?? job.clientName ?? 'Prestataire' };
}

export async function sendMessage(requestId: string, body: string): Promise<void> {
  if (!hasSupabase) return;
  const user = await currentUser();
  if (!user) return;
  const { error } = await supabase.from('messages').insert({ request_id: requestId, sender_id: user.id, body });
  if (error) throw error;
}

// So a Pro provider can "tailor their bid" against what's already on the
// table for the same request.
export async function fetchOfferStatsForRequest(requestId: string): Promise<{ count: number; min: number; max: number; avg: number } | null> {
  if (!hasSupabase) return null;
  const { data, error } = await supabase.from('offers').select('price').eq('request_id', requestId);
  if (error || !data || data.length === 0) return null;
  const prices = data.map((o: any) => o.price as number);
  return {
    count: prices.length,
    min: Math.min(...prices),
    max: Math.max(...prices),
    avg: Math.round(prices.reduce((s, p) => s + p, 0) / prices.length),
  };
}
