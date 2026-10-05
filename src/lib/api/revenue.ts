// Sèvizi — super-admin revenue report. All numbers come from the
// admin_revenue_report() RPC, which refuses anyone who isn't a super admin.
import { supabase } from '../supabase';
import { hasSupabase } from './shared';

export type RevenueStream = 'pro' | 'sevigo_plan' | 'sevigo_fee' | 'sevigo_comm' | 'job_comm';

export const REVENUE_STREAMS: { id: RevenueStream; label: string; hint: string }[] = [
  { id: 'pro', label: 'Sèvizi Pro', hint: 'Abonnements prestataires' },
  { id: 'sevigo_plan', label: 'Formules Sèvi Go', hint: 'Abonnements mensuels' },
  { id: 'sevigo_fee', label: 'Frais de facture Sèvi Go', hint: 'Au-delà des factures incluses' },
  { id: 'sevigo_comm', label: 'Commission Sèvi Go', hint: 'Sur les factures payées en ligne' },
  { id: 'job_comm', label: 'Commission missions', hint: 'Sur les paiements de missions' },
];

export type RevenueReport = {
  from: string;
  to: string;
  unit: 'day' | 'month';
  total: number;
  streams: { stream: RevenueStream; amount: number; count: number }[];
  series: { bucket: string; total: number }[];
  transactions: { at: string; stream: RevenueStream; who: string; amount: number }[];
  covered: { credit: number; discounts: number };
  volume: { jobs: number; invoices: number; deposits: number };
  pending: { count: number; amount: number };
  active: { sevigo_paid: number; sevigo_free: number; sevigo_mrr: number; pro_providers: number; users: number; providers: number };
};

export async function fetchRevenueReport(from: Date, to: Date): Promise<RevenueReport> {
  if (!hasSupabase) throw new Error('Non disponible hors ligne.');
  const { data, error } = await supabase.rpc('admin_revenue_report', { p_from: from.toISOString(), p_to: to.toISOString() });
  if (error) throw new Error(error.message);
  return data as RevenueReport;
}
