// Sèvi Go — reports & analytics (Starter and above; the till section is
// added for Unlimited). Aggregated server-side by sevigo_report().
import { supabase } from '../supabase';

export type ReportDay = { day: string; invoiced: number; paid: number };
export type PosDay = { day: string; total: number };

export type SevigoReport = {
  plan: string;
  invoices: {
    invoiced_count: number; invoiced_total: number;
    paid_count: number; paid_total: number;
    outstanding_count: number; outstanding_total: number; overdue_count: number;
    top_clients: { name: string; total: number; count: number }[];
    series: ReportDay[];
  };
  pos: null | {
    sales_count: number; sales_total: number; cash_total: number; mobile_total: number;
    voided_count: number; low_stock_count: number;
    top_products: { name: string; qty: number; revenue: number }[];
    series: PosDay[];
  };
};

// `days` back from the end of today (UTC day boundaries, matching the DB).
export async function fetchReport(days: number): Promise<SevigoReport> {
  const end = new Date(); end.setUTCHours(0, 0, 0, 0); end.setUTCDate(end.getUTCDate() + 1);
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - days);
  const { data, error } = await supabase.rpc('sevigo_report', { p_from: start.toISOString(), p_to: end.toISOString() });
  if (error) throw new Error(error.message);
  return data as SevigoReport;
}
