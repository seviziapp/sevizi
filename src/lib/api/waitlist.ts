// Sèvizi — providers-first launch: client access status + waitlist.
// The database enforces the closure (see supabase/migration_client_waitlist.sql);
// this module just lets the screens explain it and collect the waitlist.
import { supabase } from '../supabase';
import { hasSupabase } from './shared';

export type ClientAccessStatus = {
  /** Clients are open to everyone (the opening date has passed). */
  open: boolean;
  /** ISO date clients open, or null if there's no date set. */
  opensAt: string | null;
  /** This signed-in user can use the app as a client even while closed (existing account, test or admin). */
  hasAccess: boolean;
};

const OPEN: ClientAccessStatus = { open: true, opensAt: null, hasAccess: true };

export async function fetchClientAccessStatus(): Promise<ClientAccessStatus> {
  if (!hasSupabase) return OPEN;
  const { data, error } = await supabase.rpc('client_access_status');
  // If the database hasn't got the feature yet, don't lock anyone out.
  if (error || !data) return OPEN;
  return { open: !!data.open, opensAt: data.opens_at ?? null, hasAccess: !!data.has_access };
}

/** "1er janvier 2027" */
export function formatOpeningDate(iso: string | null): string {
  if (!iso) return 'bientôt';
  const d = new Date(iso);
  const day = d.getUTCDate() === 1 ? '1er' : String(d.getUTCDate());
  const month = d.toLocaleDateString('fr-FR', { month: 'long', timeZone: 'UTC' });
  return `${day} ${month} ${d.getUTCFullYear()}`;
}

export async function joinClientWaitlist(phone: string, email: string, service: string): Promise<'joined' | 'already'> {
  const { data, error } = await supabase.rpc('join_client_waitlist', {
    p_phone: phone.trim() || null, p_email: email.trim() || null, p_service: service.trim() || null,
  });
  if (error) throw new Error(error.message);
  return data === 'already' ? 'already' : 'joined';
}

// ---- admin ----

export type WaitlistEntry = { id: string; phone: string | null; email: string | null; service: string | null; createdAt: string };

export async function fetchWaitlist(): Promise<WaitlistEntry[]> {
  if (!hasSupabase) return [];
  const { data, error } = await supabase
    .from('client_waitlist').select('id, phone, email, service, created_at').order('created_at', { ascending: false }).limit(5000);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({ id: r.id, phone: r.phone, email: r.email, service: r.service, createdAt: r.created_at }));
}

export async function deleteWaitlistEntry(id: string): Promise<void> {
  const { error } = await supabase.from('client_waitlist').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
