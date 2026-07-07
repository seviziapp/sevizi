import { supabase } from './supabase';
import { getCurrentPosition } from './geolocation';
import {
  Provider, ServiceRequest, Offer, ServiceCategory, GeoPoint,
  Job, Notification, ProviderStats, AdminStats, VerificationRequest, Dispute, Review,
} from './types';

// Lomé / Bè-Kpota anchor used by the mockups
export const LOME: GeoPoint = { lat: 6.1719, lng: 1.2310 };

const hasSupabase = !!process.env.EXPO_PUBLIC_SUPABASE_URL;

// Resolve the signed-in user reliably. getSession() reads the locally persisted
// session (and refreshes it if needed) without a network round-trip, so it works
// even right after an OAuth redirect or page reload — unlike getUser(), which can
// transiently return null and surface as a spurious "Non connecté".
async function currentUser() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) return session.user;
  const fallback = await supabase.auth.getUser();
  return fallback.data.user ?? null;
}

// ---- Mock data ----

const mockProviders: Provider[] = [
  { id: 'p1', name: 'Kossi Plomberie', category: 'plomberie', rating: 4.8, reviews: 128, verified: true, distanceKm: 0.8, location: { lat: 6.1735, lng: 1.2322 }, online: true, missions: 214, yearsActive: 5, responseRate: 96, bio: 'Plombier professionnel basé à Lomé depuis 2019. Disponible 7j/7.' },
  { id: 'p2', name: 'AquaFix Togo', category: 'plomberie', rating: 4.6, reviews: 74, verified: true, distanceKm: 1.4, location: { lat: 6.1702, lng: 1.2290 }, online: true, missions: 148, yearsActive: 3, responseRate: 88 },
  { id: 'p3', name: 'Mawunyo Services', category: 'plomberie', rating: 4.3, reviews: 41, verified: false, distanceKm: 2.1, location: { lat: 6.1688, lng: 1.2345 }, online: false, missions: 67, yearsActive: 2, responseRate: 72 },
  { id: 'p4', name: 'Élec Express', category: 'electricite', rating: 4.5, reviews: 58, verified: true, distanceKm: 1.5, location: { lat: 6.1750, lng: 1.2280 }, online: true, missions: 102, yearsActive: 4, responseRate: 91 },
  { id: 'p5', name: 'Salon Afi', category: 'coiffure', rating: 4.9, reviews: 203, verified: true, distanceKm: 0.5, location: { lat: 6.1722, lng: 1.2305 }, online: true, missions: 380, yearsActive: 6, responseRate: 98 },
  { id: 'p6', name: 'Transport Koffi', category: 'transport', rating: 4.4, reviews: 89, verified: true, distanceKm: 1.1, location: { lat: 6.1745, lng: 1.2295 }, online: true, missions: 175, yearsActive: 3, responseRate: 85 },
];

const mockRequests: ServiceRequest[] = [
  { id: 'r1', clientId: 'me', description: 'Fuite sous l\'évier de la cuisine, besoin d\'un plombier aujourd\'hui.', category: 'plomberie', urgent: true, location: { lat: 6.1720, lng: 1.2315 }, locationLabel: 'Bè-Kpota, Lomé', createdAt: new Date().toISOString(), status: 'ouverte', offersCount: 3 },
  { id: 'r2', clientId: 'me', description: 'Prise de courant qui ne fonctionne plus dans le salon.', category: 'electricite', urgent: false, location: { lat: 6.1730, lng: 1.2300 }, locationLabel: 'Tokoin, Lomé', createdAt: new Date(Date.now() - 3600000).toISOString(), status: 'ouverte', offersCount: 1 },
  { id: 'r3', clientId: 'c2', description: 'Tuyau cassé dans la salle de bain.', category: 'plomberie', urgent: true, location: { lat: 6.1705, lng: 1.2330 }, locationLabel: 'Adidogomé, Lomé', createdAt: new Date(Date.now() - 1800000).toISOString(), status: 'ouverte', offersCount: 0 },
  { id: 'r4', clientId: 'c3', description: 'Peinture salon 3 pièces, environ 45m².', category: 'peinture', urgent: false, location: { lat: 6.1760, lng: 1.2280 }, locationLabel: 'Hédzranawoé, Lomé', createdAt: new Date(Date.now() - 7200000).toISOString(), status: 'ouverte', offersCount: 2 },
];

const mockOffers: Offer[] = [
  { id: 'o1', requestId: 'r1', provider: mockProviders[0], price: 4500, availability: 'Sous 2h', message: 'Je peux passer dans 2h, je règle ça aujourd\'hui.', bestPrice: true },
  { id: 'o2', requestId: 'r1', provider: mockProviders[1], price: 5000, availability: 'Aujourd\'hui' },
  { id: 'o3', requestId: 'r1', provider: mockProviders[2], price: 6200, availability: 'Demain', message: 'Je serai disponible demain matin.' },
];

const mockJobs: Job[] = [
  { id: 'j1', requestId: 'r5', provider: mockProviders[0], price: 4500, status: 'en_route', clientName: 'Ama Doe', locationLabel: 'Bè-Kpota, Lomé', location: { lat: 6.1720, lng: 1.2315 }, acceptedAt: new Date().toISOString() },
];

const mockNotifications: Notification[] = [
  { id: 'n1', type: 'offer', title: '3 offres reçues', body: 'Kossi Plomberie et 2 autres ont répondu à votre demande.', read: false, createdAt: new Date(Date.now() - 300000).toISOString(), actionRoute: '/client/offers' },
  { id: 'n2', type: 'arrived', title: 'Prestataire arrivé', body: 'Kossi Plomberie est arrivé à votre adresse.', read: false, createdAt: new Date(Date.now() - 1800000).toISOString() },
  { id: 'n3', type: 'completed', title: 'Mission terminée', body: 'Votre mission Électricité est terminée. Donnez votre avis !', read: true, createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'n4', type: 'system', title: 'Bienvenue sur Sèvizi', body: 'Votre compte a été créé avec succès.', read: true, createdAt: new Date(Date.now() - 172800000).toISOString() },
];

const mockProviderStats: ProviderStats = {
  openRequests: 4,
  sentOffers: 2,
  completedJobs: 214,
  rating: 4.8,
  earnings: 127500,
  responseRate: 96,
};

const mockAdminStats: AdminStats = {
  totalUsers: 1842,
  totalProviders: 318,
  openRequests: 47,
  completedToday: 23,
  pendingVerifications: 12,
  openDisputes: 5,
  responseRate: 84,
};

const mockVerifications: VerificationRequest[] = [
  { id: 'v1', providerName: 'Jean Agbayissa', category: 'electricite', submittedAt: new Date(Date.now() - 3600000).toISOString(), status: 'pending' },
  { id: 'v2', providerName: 'Abla Mensah', category: 'coiffure', submittedAt: new Date(Date.now() - 7200000).toISOString(), status: 'pending' },
  { id: 'v3', providerName: 'Kofi Transport', category: 'transport', submittedAt: new Date(Date.now() - 10800000).toISOString(), status: 'pending' },
  { id: 'v4', providerName: 'Senu Réparations', category: 'reparation', submittedAt: new Date(Date.now() - 86400000).toISOString(), status: 'approved' },
];

const mockDisputes: Dispute[] = [
  { id: 'd1', clientName: 'Ama Doe', providerName: 'Mawunyo Services', reason: 'Travail non conforme à l\'accord', createdAt: new Date(Date.now() - 3600000).toISOString(), status: 'ouvert' },
  { id: 'd2', clientName: 'Kosi Atta', providerName: 'AquaFix Togo', reason: 'Prestataire ne s\'est pas présenté', createdAt: new Date(Date.now() - 86400000).toISOString(), status: 'ouvert' },
  { id: 'd3', clientName: 'Yawa Nkrumah', providerName: 'Élec Express', reason: 'Prix différent du devis', createdAt: new Date(Date.now() - 172800000).toISOString(), status: 'resolu' },
];

const mockReviews: Review[] = [
  { id: 'rv1', authorName: 'Ama D.', rating: 5, comment: 'Travail impeccable, très rapide !', createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'rv2', authorName: 'Kosi A.', rating: 5, comment: 'Professionnel et ponctuel.', createdAt: new Date(Date.now() - 172800000).toISOString() },
  { id: 'rv3', authorName: 'Yawa N.', rating: 4, comment: 'Bon travail, petit retard mais expliqué.', createdAt: new Date(Date.now() - 259200000).toISOString() },
];

// ---- CLIENT API ----

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

// Priority placement is a Sèvizi Pro perk — Pro providers rank first, then by
// distance. The RPC already orders this way; this keeps the fallback/mock
// paths consistent (Array#sort is stable, so distance order within a tier
// group is preserved).
function byTierThenDistance(a: Provider, b: Provider) {
  const proA = a.tier === 'pro' ? 1 : 0;
  const proB = b.tier === 'pro' ? 1 : 0;
  return proB - proA;
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

// ---- PROFILE ----

export type MyProfile = {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  role: string;
  verified: boolean;
  onboarded: boolean;
  locationLabel: string;
  location: GeoPoint | null;
  isAdmin: boolean;
};

export async function fetchMyProfile(): Promise<MyProfile | null> {
  if (!hasSupabase) return null;
  const user = await currentUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!data) return null;
  return {
    id: data.id,
    fullName: data.full_name ?? user.user_metadata?.full_name ?? user.email ?? 'Utilisateur',
    firstName: data.first_name ?? '',
    lastName: data.last_name ?? '',
    phone: data.phone ?? user.phone ?? '',
    email: data.email ?? user.email ?? '',
    role: data.role,
    verified: !!data.verified,
    onboarded: !!data.onboarded,
    locationLabel: data.location_label ?? '',
    location: Number.isFinite(data.location_lat) && Number.isFinite(data.location_lng)
      ? { lat: data.location_lat, lng: data.location_lng } : null,
    isAdmin: !!data.is_admin,
  };
}

// Save the user's home address (label + optional coordinates). Coordinates are
// stored both as plain lat/lng (cheap to read back for "nearby" queries) and as
// a PostGIS point (for potential future geo queries on the profile itself).
export async function saveMyAddress(label: string, point?: GeoPoint): Promise<void> {
  if (!hasSupabase) return;
  const user = await currentUser();
  if (!user) return;
  const patch: any = { id: user.id, location_label: label };
  if (point) {
    patch.location_geo = `POINT(${point.lng} ${point.lat})`;
    patch.location_lat = point.lat;
    patch.location_lng = point.lng;
  }
  await supabase.from('profiles').upsert(patch);
}

// Resolve the best available anchor point for "nearby" queries and map
// centering: live GPS first (most accurate), then the user's saved address,
// then the Lomé city center as a last resort. Never throws.
export async function resolveMyLocation(): Promise<GeoPoint> {
  const gps = await getCurrentPosition();
  if (gps) return gps;
  try {
    const profile = await fetchMyProfile();
    if (profile?.location) return profile.location;
  } catch {}
  return LOME;
}

// ---- SIGNUP DETAILS + VERIFICATION ----

// Upload a document blob to Supabase Storage and return its public URL.
export async function uploadDocument(blob: Blob, folder: string, filename: string): Promise<string> {
  const user = await currentUser();
  if (!user) throw new Error('Non connecté');
  const ext = (filename.split('.').pop() || 'jpg').toLowerCase();
  const path = `${folder}/${user.id}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('documents').upload(path, blob, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from('documents').getPublicUrl(path);
  return data.publicUrl;
}

// Client finishes signup: first/last name, phone, email.
export async function saveClientDetails(input: { firstName: string; lastName: string; phone: string; email: string }): Promise<void> {
  const user = await currentUser();
  if (!user) throw new Error('Non connecté');
  const fullName = `${input.firstName} ${input.lastName}`.trim();
  // Try the full column set; if the extended columns aren't present yet
  // (migration not run), fall back to the base columns so signup still saves.
  const { error } = await supabase.from('profiles').upsert({
    id: user.id, role: 'client',
    first_name: input.firstName, last_name: input.lastName, full_name: fullName,
    phone: input.phone, email: input.email, onboarded: true,
  });
  if (error) {
    const { error: e2 } = await supabase.from('profiles').upsert({
      id: user.id, role: 'client', full_name: fullName, phone: input.phone,
    });
    if (e2) throw e2;
  }
}

// Provider finishes signup: company name, owner first/last name, category, phone.
export async function saveProviderDetails(input: {
  companyName: string; firstName: string; lastName: string; category: ServiceCategory; phone: string; email: string; bio?: string;
  tier?: 'free' | 'pro'; // chosen on the sign-up tier picker — 'pro' just means
  // "kick off PayDunya checkout right after this call" (see provider-details.tsx);
  // the row itself is always created as 'free' here. Only the PayDunya webhook
  // (createProSubscriptionInvoice / paydunya-webhook) can actually grant Pro —
  // enforced DB-side by trg_protect_provider_tier, not just by this function.
}): Promise<void> {
  const user = await currentUser();
  if (!user) throw new Error('Non connecté');
  const fullName = `${input.firstName} ${input.lastName}`.trim();

  // 1) Business row FIRST — uses only base columns, so onboarding completes
  //    (index checks for this row) even if profile columns are missing.
  //    limit(1) (not maybeSingle) so an existing duplicate doesn't error and
  //    cause yet another row to be inserted.
  const { data: existingRows } = await supabase.from('providers').select('id').eq('user_id', user.id).limit(1);
  const existing = existingRows?.[0];
  if (existing) {
    const { error } = await supabase.from('providers').update({
      name: input.companyName, category: input.category, bio: input.bio ?? null,
    }).eq('user_id', user.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('providers').insert({
      user_id: user.id, name: input.companyName, category: input.category,
      bio: input.bio ?? null, geo: `POINT(${LOME.lng} ${LOME.lat})`,
    });
    if (error) throw error;
  }

  // 2) Owner identity on the profile — full set, else base columns.
  const { error: pErr } = await supabase.from('profiles').upsert({
    id: user.id, role: 'prestataire',
    first_name: input.firstName, last_name: input.lastName, full_name: fullName,
    phone: input.phone, email: input.email, onboarded: true,
  });
  if (pErr) {
    await supabase.from('profiles').upsert({
      id: user.id, role: 'prestataire', full_name: fullName, phone: input.phone,
    });
  }
}

// Client submits ID for verification.
export async function submitClientVerification(idDocUrl: string): Promise<void> {
  const user = await currentUser();
  if (!user) throw new Error('Non connecté');
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
  await supabase.from('profiles').update({ id_doc_url: idDocUrl }).eq('id', user.id);
  const { error } = await supabase.from('verification_requests').insert({
    user_id: user.id,
    type: 'client',
    display_name: profile?.full_name ?? 'Client',
    id_doc_url: idDocUrl,
    status: 'pending',
  });
  if (error) throw error;
}

// Provider submits company info + owner's license for verification.
export async function submitProviderVerification(input: { companyInfo: string; tradeDocUrl?: string; idDocUrl?: string }): Promise<void> {
  const user = await currentUser();
  if (!user) throw new Error('Non connecté');
  const { data: provider } = await supabase.from('providers').select('id, name').eq('user_id', user.id).single();
  if (!provider) throw new Error('Profil prestataire introuvable');
  const { error } = await supabase.from('verification_requests').insert({
    user_id: user.id,
    provider_id: provider.id,
    type: 'provider',
    display_name: provider.name,
    company_info: input.companyInfo,
    trade_doc_url: input.tradeDocUrl ?? null,
    id_doc_url: input.idDocUrl ?? null,
    status: 'pending',
  });
  if (error) throw error;
}

// Current user's verification state, for showing badges / status.
export async function fetchMyVerificationStatus(): Promise<'none' | 'pending' | 'approved' | 'rejected'> {
  if (!hasSupabase) return 'none';
  const user = await currentUser();
  if (!user) return 'none';
  const { data } = await supabase
    .from('verification_requests')
    .select('status')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  return (data?.status as any) ?? 'none';
}

export async function fetchMyProviderProfile(): Promise<Provider | null> {
  if (!hasSupabase) return null;
  const user = await currentUser();
  if (!user) return null;
  // limit(1) (not single) so duplicate rows don't throw and read as "no provider".
  const { data: rows } = await supabase.from('providers').select('*').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1);
  const data = rows?.[0];
  if (!data) return null;
  return {
    id: data.id, name: data.name, category: data.category, rating: data.rating ?? 0,
    reviews: data.reviews ?? 0, verified: !!data.verified, online: !!data.online,
    missions: data.missions ?? 0, yearsActive: data.years_active ?? 0, responseRate: data.response_rate ?? 0,
    bio: data.bio ?? undefined, gallery: data.gallery ?? [], distanceKm: 0, location: LOME,
    tier: data.tier ?? 'free', categories: data.categories ?? [],
  };
}

// Provider edits their public profile: business name, bio, gallery photos,
// and (Pro only) the extra service categories they also offer.
export async function updateProviderProfile(input: { name?: string; bio?: string; gallery?: string[]; categories?: ServiceCategory[] }): Promise<void> {
  if (!hasSupabase) return;
  const user = await currentUser();
  if (!user) throw new Error('Non connecté');
  const patch: any = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.bio !== undefined) patch.bio = input.bio;
  if (input.gallery !== undefined) patch.gallery = input.gallery;
  if (input.categories !== undefined) patch.categories = input.categories;
  const { error } = await supabase.from('providers').update(patch).eq('user_id', user.id);
  if (error) throw error;
}

// Starts a real PayDunya checkout for the Sèvizi Pro monthly subscription.
// Returns the hosted checkout page URL to open (mobile money / card) — the
// provider is only actually flipped to Pro once PayDunya confirms payment
// and the paydunya-webhook Edge Function processes it (see
// supabase/migration_paydunya.sql for why this can't happen client-side).
export async function createProSubscriptionInvoice(returnUrl: string, cancelUrl: string): Promise<{ invoiceUrl: string }> {
  if (!hasSupabase) throw new Error('Paiement indisponible en mode démo');
  const { data, error } = await supabase.functions.invoke('paydunya-create-invoice', {
    body: { returnUrl, cancelUrl },
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

// ---- PROVIDER API ----

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

export async function sendOffer(input: { requestId: string; price: number; availability: string; message?: string }): Promise<void> {
  if (!hasSupabase) return;
  const user = await currentUser();
  if (!user) throw new Error('Non connecté');
  const { data: providerData } = await supabase.from('providers').select('id').eq('user_id', user.id).single();
  if (!providerData) throw new Error('Profil prestataire introuvable');
  const { error } = await supabase.from('offers').insert({
    request_id: input.requestId, provider_id: providerData.id,
    price: input.price, availability: input.availability, message: input.message,
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

// ---- ADMIN API ----

export async function fetchAdminStats(): Promise<AdminStats> {
  if (!hasSupabase) return { totalUsers: 0, totalProviders: 0, openRequests: 0, completedToday: 0, pendingVerifications: 0, openDisputes: 0, responseRate: 0 };
  const [users, providers, requests, jobs] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('providers').select('id', { count: 'exact', head: true }),
    supabase.from('requests').select('id', { count: 'exact', head: true }).eq('status', 'ouverte'),
    supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'termine'),
  ]);
  return {
    totalUsers: users.count ?? 0,
    totalProviders: providers.count ?? 0,
    openRequests: requests.count ?? 0,
    completedToday: jobs.count ?? 0,
    pendingVerifications: 0,
    openDisputes: 0,
    responseRate: 0,
  };
}

export async function fetchVerificationQueue(): Promise<VerificationRequest[]> {
  if (!hasSupabase) return [];
  const { data, error } = await supabase
    .from('verification_requests')
    .select('*, provider:providers(name, category)')
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data ?? []).map((v: any) => ({
    id: v.id,
    type: v.type ?? 'provider',
    displayName: v.display_name ?? v.provider?.name ?? 'Sans nom',
    category: v.provider?.category,
    submittedAt: v.created_at,
    status: v.status,
    idDocUrl: v.id_doc_url ?? undefined,
    tradeDocUrl: v.trade_doc_url ?? undefined,
    companyInfo: v.company_info ?? undefined,
  }));
}

export async function approveVerification(id: string): Promise<void> {
  if (!hasSupabase) return;
  const { data: vr } = await supabase
    .from('verification_requests')
    .select('provider_id, user_id, type')
    .eq('id', id)
    .single();
  await supabase.from('verification_requests')
    .update({ status: 'approved', reviewed_at: new Date().toISOString() })
    .eq('id', id);
  if (vr?.type === 'client' && vr.user_id) {
    await supabase.from('profiles').update({ verified: true }).eq('id', vr.user_id);
  } else if (vr?.provider_id) {
    await supabase.from('providers').update({ verified: true }).eq('id', vr.provider_id);
  }
}

export async function rejectVerification(id: string): Promise<void> {
  if (!hasSupabase) return;
  await supabase.from('verification_requests').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', id);
}

export async function fetchDisputes(): Promise<Dispute[]> {
  if (!hasSupabase) return [];
  const { data, error } = await supabase
    .from('disputes')
    .select('*, job:jobs(client_name, provider:providers(name))')
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data ?? []).map((d: any) => ({
    id: d.id, reason: d.reason, status: d.status, createdAt: d.created_at,
    clientName: d.job?.client_name ?? 'Client',
    providerName: d.job?.provider?.name ?? 'Prestataire',
    reporterName: d.reporter_name ?? 'Utilisateur',
    reporterRole: (d.reporter_role ?? '') as any,
  }));
}

export async function resolveDispute(id: string): Promise<void> {
  if (!hasSupabase) return;
  await supabase.from('disputes').update({ status: 'resolu', resolved_at: new Date().toISOString() }).eq('id', id);
}

// A client or provider signals a problem on their mission → goes to the admin.
export async function reportDispute(jobId: string, reason: string): Promise<void> {
  if (!hasSupabase) return;
  const user = await currentUser();
  if (!user) throw new Error('Non connecté');
  const { data: me } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single();
  const { error } = await supabase.from('disputes').insert({
    job_id: jobId,
    reporter_id: user.id,
    reason,
    reporter_name: me?.full_name ?? 'Utilisateur',
    reporter_role: me?.role ?? null,
    status: 'ouvert',
  });
  if (error) throw error;
}
