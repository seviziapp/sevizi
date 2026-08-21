// Sèvizi — account/profile API shared by both roles: signup details,
// verification, the profile record, address/location, and the Sèvizi Pro
// shareable booking-link username. Split out of the former monolithic
// api.ts (Phase 1); every function body is unchanged.
import { supabase } from '../supabase';
import { GeoPoint, ServiceCategory, Provider } from '../types';
import { getCurrentPosition } from '../geolocation';
import { LOME, hasSupabase, currentUser } from './shared';

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
    bookable: !!data.bookable,
    commissionDiscountPct: data.commission_discount_pct ?? 0,
    commissionDiscountUntil: data.commission_discount_until ?? null,
    username: data.username ?? null,
  };
}

// Provider edits their public profile: business name, bio, gallery photos,
// and (Pro only) the extra service categories they also offer.
export async function updateProviderProfile(input: { name?: string; bio?: string; gallery?: string[]; category?: ServiceCategory; categories?: ServiceCategory[]; yearsActive?: number }): Promise<void> {
  if (!hasSupabase) return;
  const user = await currentUser();
  if (!user) throw new Error('Non connecté');
  const patch: any = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.bio !== undefined) patch.bio = input.bio;
  if (input.gallery !== undefined) patch.gallery = input.gallery;
  if (input.category !== undefined) patch.category = input.category;
  if (input.categories !== undefined) patch.categories = input.categories;
  if (input.yearsActive !== undefined) patch.years_active = input.yearsActive;
  const { error } = await supabase.from('providers').update(patch).eq('user_id', user.id);
  if (error) throw error;
}

// ---- Shareable booking link (Sèvizi Pro) ----

// Cheap client-side format check mirroring the DB constraint
// (providers_username_format) — checked again server-side on save regardless.
export function isValidUsername(username: string): boolean {
  return /^[a-z0-9-]{3,30}$/.test(username);
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  if (!hasSupabase) return true;
  const user = await currentUser();
  const { data } = await supabase.from('providers').select('id, user_id').eq('username', username).maybeSingle();
  if (!data) return true;
  // Taken by someone else — unless it's already this provider's own username.
  return data.user_id === user?.id;
}

export async function updateProviderUsername(username: string): Promise<void> {
  if (!hasSupabase) return;
  const user = await currentUser();
  if (!user) throw new Error('Non connecté');
  if (!isValidUsername(username)) {
    throw new Error('3 à 30 caractères : lettres minuscules, chiffres et tirets uniquement.');
  }
  const { error } = await supabase.from('providers').update({ username }).eq('user_id', user.id);
  if (error) {
    // Postgres unique_violation — someone claimed it between the availability
    // check and this save.
    if ((error as any).code === '23505') throw new Error('Ce nom est déjà pris. Essayez-en un autre.');
    throw error;
  }
}

// Public lookup for the /b/<username> share-link landing page — no auth
// required, matches the "providers readable" (select using (true)) policy.
export async function fetchProviderByUsername(username: string): Promise<Provider | null> {
  if (!hasSupabase) return null;
  const { data } = await supabase.from('providers').select('*').eq('username', username).maybeSingle();
  if (!data) return null;
  return {
    id: data.id, name: data.name, category: data.category, rating: data.rating ?? 0,
    reviews: data.reviews ?? 0, verified: !!data.verified, online: !!data.online,
    missions: data.missions ?? 0, yearsActive: data.years_active ?? 0, responseRate: data.response_rate ?? 0,
    bio: data.bio ?? undefined, gallery: data.gallery ?? [], distanceKm: 0, location: LOME,
    tier: data.tier ?? 'free', categories: data.categories ?? [],
    bookable: !!data.bookable, username: data.username ?? null,
  };
}

// Self-service account deletion. Irreversible — deletes the caller's own
// auth account via delete-account (only service-role can call the Admin
// API that actually does this). See supabase/migration_account_deletion.sql:
// personal data (profile, provider listing, messages, favorites,
// verification docs) is fully removed; the other party's financial/rating
// records for shared jobs survive with this user's identity nulled out.
export async function deleteMyAccount(): Promise<void> {
  if (!hasSupabase) return;
  const { data, error } = await supabase.functions.invoke('delete-account');
  if (error) {
    const context = (error as any)?.context;
    let bodyMessage: string | undefined;
    if (context && typeof context.json === 'function') {
      try {
        const body = await context.json();
        bodyMessage = body?.error;
      } catch { /* fall through to the generic error */ }
    }
    throw new Error(bodyMessage ?? error.message);
  }
  if (data?.error) throw new Error(data.error);
}
