// Sèvizi — admin back-office API: dashboard stats, verification queue,
// withdrawal requests, disputes, and the activity feed. Split out of the
// former monolithic api.ts (Phase 1); every function body is unchanged.
import { supabase } from '../supabase';
import { AdminStats, VerificationRequest, WithdrawalRequest, Dispute, AdminActivityItem, AdminOpenRequest } from '../types';
import { hasSupabase, currentUser } from './shared';

// ---- ADMIN: team (super admin only) ----

export type AdminTeamMember = {
  id: string;
  fullName: string;
  email: string;
  isSuperAdmin: boolean;
  forcePasswordChange: boolean;
  createdAt: string;
};

export async function fetchAdminTeam(): Promise<AdminTeamMember[]> {
  if (!hasSupabase) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, is_super_admin, force_password_change, created_at')
    .eq('is_admin', true)
    .order('created_at', { ascending: true });
  if (error) return [];
  return (data ?? []).map((a: any) => ({
    id: a.id,
    fullName: a.full_name ?? 'Sans nom',
    email: a.email ?? '',
    isSuperAdmin: !!a.is_super_admin,
    forcePasswordChange: !!a.force_password_change,
    createdAt: a.created_at,
  }));
}

async function invokeAdminFn(name: string, body: Record<string, unknown>): Promise<void> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const context = (error as any)?.context;
    let bodyMessage: string | undefined;
    if (context && typeof context.json === 'function') {
      try { bodyMessage = (await context.json())?.error; } catch { /* fall through */ }
    }
    throw new Error(bodyMessage ?? error.message);
  }
  if (data?.error) throw new Error(data.error);
}

// Creates a brand-new admin login (own auth account, never a client/
// prestataire account promoted in place) with a temporary password the
// super admin shares with them out-of-band. Super-admin only — enforced
// server-side in admin-create-admin.
export async function createAdmin(input: { email: string; fullName: string; temporaryPassword: string }): Promise<void> {
  await invokeAdminFn('admin-create-admin', {
    email: input.email, fullName: input.fullName, temporaryPassword: input.temporaryPassword,
  });
}

export async function promoteToSuperAdmin(targetId: string): Promise<void> {
  await invokeAdminFn('admin-set-role', { targetId, action: 'promote' });
}

export async function demoteFromSuperAdmin(targetId: string): Promise<void> {
  await invokeAdminFn('admin-set-role', { targetId, action: 'demote' });
}

// Deletes the admin's login outright — an admin account has no other use.
export async function revokeAdmin(targetId: string): Promise<void> {
  await invokeAdminFn('admin-set-role', { targetId, action: 'revoke' });
}

// ---- ADMIN: broadcast notifications ----

export type BroadcastAudience = 'client' | 'prestataire' | 'all';

// Pushes one notification to every client, every provider, or everyone —
// delivered through the normal notifications screen. Returns how many
// accounts received it. Admin accounts never receive their own broadcasts
// (enforced server-side in admin_broadcast_notification).
export async function broadcastNotification(input: {
  audience: BroadcastAudience; title: string; body: string; actionRoute?: string;
}): Promise<number> {
  if (!hasSupabase) return 0;
  const { data, error } = await supabase.rpc('admin_broadcast_notification', {
    p_audience: input.audience, p_title: input.title, p_body: input.body,
    p_action_route: input.actionRoute ?? null,
  });
  if (error) throw error;
  return data as number;
}

export async function fetchAdminStats(): Promise<AdminStats> {
  if (!hasSupabase) return { totalUsers: 0, totalProviders: 0, openRequests: 0, completedToday: 0, pendingVerifications: 0, openDisputes: 0, responseRate: 0, pendingWithdrawals: 0 };
  const [users, providers, requests, jobs, verifications, disputes, withdrawals] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('providers').select('id', { count: 'exact', head: true }),
    supabase.from('requests').select('id', { count: 'exact', head: true }).eq('status', 'ouverte'),
    supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'termine'),
    supabase.from('verification_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('disputes').select('id', { count: 'exact', head: true }).eq('status', 'ouvert'),
    supabase.from('withdrawal_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);
  return {
    totalUsers: users.count ?? 0,
    totalProviders: providers.count ?? 0,
    openRequests: requests.count ?? 0,
    completedToday: jobs.count ?? 0,
    pendingVerifications: verifications.count ?? 0,
    openDisputes: disputes.count ?? 0,
    responseRate: 0,
    pendingWithdrawals: withdrawals.count ?? 0,
  };
}

// Pending only — once approved/rejected, a request drops off this queue
// (the admin already acted on it; nothing to keep watching).
export async function fetchVerificationQueue(): Promise<VerificationRequest[]> {
  if (!hasSupabase) return [];
  const { data, error } = await supabase
    .from('verification_requests')
    .select('*, provider:providers(name, category)')
    .eq('status', 'pending')
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

// ---- ADMIN: withdrawal requests ----

export async function fetchWithdrawalRequests(): Promise<WithdrawalRequest[]> {
  if (!hasSupabase) return [];
  const { data, error } = await supabase
    .from('withdrawal_requests').select('*, provider:providers(name)')
    .order('requested_at', { ascending: false });
  if (error) return [];
  return (data ?? []).map((w: any) => ({
    id: w.id, providerName: w.provider?.name ?? 'Client Sèvi Go', amount: w.amount,
    method: w.method, phone: w.phone, status: w.status,
    requestedAt: w.requested_at, resolvedAt: w.resolved_at ?? undefined,
  }));
}

export async function markWithdrawalSent(id: string): Promise<void> {
  if (!hasSupabase) return;
  const { error } = await supabase
    .from('withdrawal_requests')
    .update({ status: 'sent', resolved_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
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

// ---- ADMIN: open requests (follow up by phone so they don't sit forever) ----

// Oldest first — the ones that have been sitting open longest are the most
// urgent to call about, so they surface at the top.
//
// client_id references auth.users, not profiles — PostgREST can't resolve a
// `client:profiles(...)` embed across that gap (no direct FK for it to find),
// so it used to 400 on every call here and the caught error silently
// returned [] — the list looked empty while the dashboard's plain count
// (no embed) correctly showed the real number. Fetching profiles separately
// and merging in JS sidesteps the embed entirely.
export async function fetchOpenRequestsAdmin(): Promise<AdminOpenRequest[]> {
  if (!hasSupabase) return [];
  const { data, error } = await supabase
    .from('requests')
    .select('*, offers(count)')
    .eq('status', 'ouverte')
    .order('created_at', { ascending: true });
  if (error) return [];
  const rows = data ?? [];

  const clientIds = [...new Set(rows.map((r: any) => r.client_id).filter(Boolean))];
  const { data: clients } = clientIds.length
    ? await supabase.from('profiles').select('id, full_name, phone').in('id', clientIds)
    : { data: [] as any[] };
  const clientById = new Map((clients ?? []).map((c: any) => [c.id, c]));

  return rows.map((r: any) => {
    const client = clientById.get(r.client_id);
    return {
      id: r.id,
      clientName: client?.full_name ?? 'Client',
      clientPhone: client?.phone ?? null,
      description: r.description,
      category: r.category,
      urgent: r.urgent,
      locationLabel: r.location_label ?? '',
      createdAt: r.created_at,
      offersCount: r.offers?.[0]?.count ?? 0,
    };
  });
}

// Admin resolves a stale request by phone (client found someone elsewhere,
// no longer needs it, etc.) — closes it out so it stops counting against
// "demandes ouvertes".
export async function adminCloseRequest(id: string, status: 'annulee' | 'terminee'): Promise<void> {
  if (!hasSupabase) return;
  const { error } = await supabase.from('requests').update({ status }).eq('id', id);
  if (error) throw error;
}

// ---- ADMIN: activity feed ----

// Merges recent "new service" listings and completed sales (job payments,
// appointment deposits, Pro subscriptions) into one time-sorted feed — no
// dedicated audit-log table, just a few parallel reads across tables admin
// can already see (see migration_service_photos_and_admin_activity.sql for
// the two RLS additions this needed on job_payments/pro_payments).
export async function fetchAdminActivity(limit = 50): Promise<AdminActivityItem[]> {
  if (!hasSupabase) return [];
  const [services, jobSales, apptSales, proSales] = await Promise.all([
    supabase.from('provider_services').select('id, name, price, created_at, provider:providers(name)')
      .order('created_at', { ascending: false }).limit(limit),
    supabase.from('job_payments').select('id, amount, net_amount, confirmed_at, created_at, status, provider:providers(name)')
      .eq('status', 'completed').order('confirmed_at', { ascending: false }).limit(limit),
    supabase.from('appointments').select('id, service_name, price, deposit_amount, confirmed_at, created_at, deposit_status, provider:providers(name)')
      .eq('deposit_status', 'paid').order('confirmed_at', { ascending: false }).limit(limit),
    supabase.from('pro_payments').select('id, amount, confirmed_at, created_at, status, provider:providers(name)')
      .eq('status', 'completed').order('confirmed_at', { ascending: false }).limit(limit),
  ]);

  const items: AdminActivityItem[] = [
    ...(services.data ?? []).map((s: any): AdminActivityItem => ({
      id: `service-${s.id}`, kind: 'service_created',
      title: `Nouveau service : ${s.name}`,
      subtitle: `${s.provider?.name ?? 'Prestataire'} · ${(s.price ?? 0).toLocaleString('fr-FR')} F`,
      createdAt: s.created_at,
    })),
    ...(jobSales.data ?? []).map((j: any): AdminActivityItem => ({
      id: `job-${j.id}`, kind: 'job_sale',
      title: `Mission payée`,
      subtitle: `${j.provider?.name ?? 'Prestataire'} · net ${(j.net_amount ?? 0).toLocaleString('fr-FR')} F`,
      amount: j.amount, createdAt: j.confirmed_at ?? j.created_at,
    })),
    ...(apptSales.data ?? []).map((a: any): AdminActivityItem => ({
      id: `appt-${a.id}`, kind: 'appointment_sale',
      title: `Acompte rendez-vous : ${a.service_name}`,
      subtitle: `${a.provider?.name ?? 'Prestataire'} · ${(a.deposit_amount ?? 0).toLocaleString('fr-FR')} F`,
      amount: a.deposit_amount, createdAt: a.confirmed_at ?? a.created_at,
    })),
    ...(proSales.data ?? []).map((p: any): AdminActivityItem => ({
      id: `pro-${p.id}`, kind: 'pro_sale',
      title: `Abonnement Sèvizi Pro`,
      subtitle: `${p.provider?.name ?? 'Prestataire'} · ${(p.amount ?? 0).toLocaleString('fr-FR')} F`,
      amount: p.amount, createdAt: p.confirmed_at ?? p.created_at,
    })),
  ];

  return items
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    .slice(0, limit);
}
