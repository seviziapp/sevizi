// Sèvizi — admin back-office API: dashboard stats, verification queue,
// withdrawal requests, disputes, and the activity feed. Split out of the
// former monolithic api.ts (Phase 1); every function body is unchanged.
import { supabase } from '../supabase';
import { AdminStats, VerificationRequest, WithdrawalRequest, Dispute, AdminActivityItem } from '../types';
import { hasSupabase, currentUser } from './shared';

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

// ---- ADMIN: withdrawal requests ----

export async function fetchWithdrawalRequests(): Promise<WithdrawalRequest[]> {
  if (!hasSupabase) return [];
  const { data, error } = await supabase
    .from('withdrawal_requests').select('*, provider:providers(name)')
    .order('requested_at', { ascending: false });
  if (error) return [];
  return (data ?? []).map((w: any) => ({
    id: w.id, providerName: w.provider?.name ?? 'Prestataire', amount: w.amount,
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
