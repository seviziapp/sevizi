// Sèvizi — discount code API: admin CRUD plus the provider-side commission
// redemption. Split out of the former monolithic api.ts (Phase 1); every
// function body is unchanged.
import { supabase } from '../supabase';
import { DiscountCode } from '../types';
import { hasSupabase } from './shared';

function mapDiscountCode(d: any): DiscountCode {
  return {
    id: d.id, code: d.code, label: d.label ?? undefined,
    kind: d.kind, appliesTo: d.applies_to, value: d.value,
    durationDays: d.duration_days ?? null, maxRedemptions: d.max_redemptions ?? null,
    redemptionCount: d.redemption_count ?? 0, active: !!d.active,
    expiresAt: d.expires_at ?? null, createdAt: d.created_at,
  };
}

export async function fetchDiscountCodes(): Promise<DiscountCode[]> {
  if (!hasSupabase) return [];
  const { data, error } = await supabase.from('discount_codes').select('*').order('created_at', { ascending: false });
  if (error) return [];
  return (data ?? []).map(mapDiscountCode);
}

export async function saveDiscountCode(input: {
  id?: string; code: string; label?: string; kind: 'percent' | 'flat'; appliesTo: 'commission' | 'membership' | 'both';
  value: number; durationDays?: number | null; maxRedemptions?: number | null; expiresAt?: string | null; active: boolean;
}): Promise<void> {
  if (!hasSupabase) return;
  const patch = {
    code: input.code.trim().toUpperCase(), label: input.label?.trim() || null,
    kind: input.kind, applies_to: input.appliesTo, value: input.value,
    duration_days: input.durationDays ?? null, max_redemptions: input.maxRedemptions ?? null,
    expires_at: input.expiresAt ?? null, active: input.active,
  };
  if (input.id) {
    const { error } = await supabase.from('discount_codes').update(patch).eq('id', input.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('discount_codes').insert(patch);
    if (error) throw error;
  }
}

export async function deleteDiscountCode(id: string): Promise<void> {
  if (!hasSupabase) return;
  const { error } = await supabase.from('discount_codes').delete().eq('id', id);
  if (error) throw error;
}

// Redeems a 'commission' code, applying the discount to the caller's
// provider account immediately (server-validated — see redeem_discount_code
// in supabase/migration_discounts.sql).
export async function redeemCommissionDiscountCode(code: string): Promise<{ pct: number; durationDays: number | null; label?: string }> {
  if (!hasSupabase) throw new Error('Indisponible en mode démo');
  const { data, error } = await supabase.rpc('redeem_discount_code', { p_code: code.trim(), p_purpose: 'commission' });
  if (error) throw new Error(error.message);
  return { pct: data.value, durationDays: data.durationDays ?? null, label: data.label ?? undefined };
}
