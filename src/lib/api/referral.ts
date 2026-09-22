// Sèvizi — affiliate/referral program: self-chosen codes, restricted
// credit balance, and redemption at signup. See
// supabase/migration_referral_program.sql for the full model — the 300F
// credit granted here is never cash; it can only reduce what Sèvizi itself
// charges (Pro subscription, Sèvi Go plans/fees), applied server-side in
// the relevant create-payment Edge Functions.
import { supabase } from '../supabase';
import { hasSupabase, currentUser } from './shared';

export type ReferralOverview = {
  code: string | null;
  balance: number;
  referredCount: number;
};

export async function fetchReferralOverview(): Promise<ReferralOverview> {
  if (!hasSupabase) return { code: null, balance: 0, referredCount: 0 };
  const user = await currentUser();
  if (!user) return { code: null, balance: 0, referredCount: 0 };
  const [{ data: codeRow }, { data: balance }, { count }] = await Promise.all([
    supabase.from('referral_codes').select('code').eq('user_id', user.id).maybeSingle(),
    supabase.rpc('referral_credit_balance', { p_user_id: user.id }),
    supabase.from('referral_signups').select('id', { count: 'exact', head: true }).eq('referrer_id', user.id),
  ]);
  return { code: codeRow?.code ?? null, balance: (balance as number) ?? 0, referredCount: count ?? 0 };
}

// Cheap client-side format check, matches the DB unique constraint's
// expectations — checked again server-side (case-normalized) regardless.
export function isValidReferralCode(code: string): boolean {
  return /^[A-Z0-9-]{3,20}$/.test(code);
}

export async function chooseReferralCode(code: string): Promise<void> {
  if (!hasSupabase) return;
  const user = await currentUser();
  if (!user) throw new Error('Non connecté');
  const normalized = code.trim().toUpperCase();
  if (!isValidReferralCode(normalized)) {
    throw new Error('3 à 20 caractères : lettres, chiffres et tirets uniquement.');
  }
  const { error } = await supabase.from('referral_codes').insert({ user_id: user.id, code: normalized });
  if (error) {
    if ((error as any).code === '23505') throw new Error('Ce code est déjà pris, ou vous en avez déjà un.');
    throw error;
  }
}

// Best-effort: called right after a new account finishes onboarding. Never
// blocks or fails the signup itself — an invalid, unknown, self-referral,
// or already-redeemed code just silently grants nothing (see
// redeem_referral_code for the exact rejection reasons).
export async function redeemReferralCode(code: string): Promise<void> {
  if (!hasSupabase || !code.trim()) return;
  try {
    await supabase.rpc('redeem_referral_code', { p_code: code.trim().toUpperCase() });
  } catch {
    // ignore — see comment above
  }
}

export type ReferralCreditEntry = { id: string; amount: number; kind: string; note: string | null; createdAt: string };

export async function fetchReferralCreditHistory(): Promise<ReferralCreditEntry[]> {
  if (!hasSupabase) return [];
  const user = await currentUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('referral_credits').select('*').eq('user_id', user.id)
    .order('created_at', { ascending: false }).limit(30);
  if (error) return [];
  return (data ?? []).map((r: any) => ({ id: r.id, amount: r.amount, kind: r.kind, note: r.note, createdAt: r.created_at }));
}
