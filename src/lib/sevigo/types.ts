// Sèvi Go — POS/invoicing module. Domain types matching supabase/migration_sevigo.sql.

export type SevigoPlanId = 'payg' | 'starter' | 'growth' | 'unlimited';

export interface SevigoPlan {
  id: SevigoPlanId;
  label: string;
  priceLabel: string;
  monthlyFee: number;           // FCFA/month, 0 for payg
  includedInvoices: number | null; // null = unlimited
  extraInvoiceFee: number;      // FCFA per invoice beyond included (or per invoice for payg)
  paydunyaFeePct: number;       // cut Sèvi Go takes off each PayDunya payment, e.g. 0.10
  hasReports: boolean;
  hasPos: boolean;
}

// Pricing per the Sèvi Go product spec. The PayDunya cut applies to every
// plan (payg/starter included) until confirmed otherwise — see note on
// SEVIGO_PLANS below.
export const SEVIGO_PLANS: SevigoPlan[] = [
  { id: 'payg',      label: 'Pay As You Go',   priceLabel: '500 F / facture', monthlyFee: 0,     includedInvoices: 0,  extraInvoiceFee: 500, paydunyaFeePct: 0.10, hasReports: false, hasPos: false },
  { id: 'starter',   label: 'Starter',         priceLabel: '2 000 F / mois',  monthlyFee: 2000,  includedInvoices: 15, extraInvoiceFee: 500, paydunyaFeePct: 0.10, hasReports: true,  hasPos: false },
  { id: 'growth',    label: 'Growth',          priceLabel: '5 000 F / mois',  monthlyFee: 5000,  includedInvoices: 50, extraInvoiceFee: 350, paydunyaFeePct: 0.07, hasReports: true,  hasPos: false },
  { id: 'unlimited', label: 'Unlimited / Pro', priceLabel: '10 000 F / mois', monthlyFee: 10000, includedInvoices: null, extraInvoiceFee: 0,  paydunyaFeePct: 0.05, hasReports: true,  hasPos: true  },
];

// 'pending_fee' = created but locked: a Sèvi Go generation fee applies (see
// invoiceFeeForUsage) and hasn't been paid yet. No content should be shown,
// shared, emailed, or printed while an invoice is in this state.
export type SevigoInvoiceStatus = 'pending_fee' | 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
export type SevigoInvoiceTemplate = 'classic' | 'modern' | 'minimal';

export interface SevigoLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;      // FCFA
  discountPct?: number;   // per-line discount, 0-100
}

export interface SevigoInvoice {
  id: string;
  number: string;         // e.g. "INV-0001"
  clientName: string;
  clientContact?: string;
  clientEmail?: string;
  items: SevigoLineItem[];
  discountPct?: number;   // invoice-wide discount, 0-100
  discountFlat?: number;  // invoice-wide flat discount, FCFA
  subtotal: number;
  total: number;
  status: SevigoInvoiceStatus;
  generationFee?: number; // present when status is 'pending_fee' — amount owed to unlock
  template: SevigoInvoiceTemplate;
  createdAt: string;
  dueDate?: string | null;
  paymentUrl?: string | null;
  notes?: string;
}

export interface SevigoBusinessProfile {
  businessName: string;
  logoUrl?: string | null;
  brandColor?: string | null;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
}

export interface SevigoUsage {
  planId: SevigoPlanId;
  cycleStart: string;
  invoicesThisCycle: number;
}

// -- Pure calculation helpers (no I/O) --

export function computeLineTotal(item: SevigoLineItem): number {
  const raw = item.quantity * item.unitPrice;
  const disc = item.discountPct ? raw * (item.discountPct / 100) : 0;
  return Math.max(0, raw - disc);
}

export function computeInvoiceTotals(
  items: SevigoLineItem[],
  discountPct?: number,
  discountFlat?: number,
): { subtotal: number; total: number } {
  const subtotal = items.reduce((sum, it) => sum + computeLineTotal(it), 0);
  let total = subtotal;
  if (discountPct) total -= total * (discountPct / 100);
  if (discountFlat) total -= discountFlat;
  return { subtotal, total: Math.max(0, Math.round(total)) };
}

export function planById(id: SevigoPlanId): SevigoPlan {
  return SEVIGO_PLANS.find(p => p.id === id) ?? SEVIGO_PLANS[0];
}

// Per-invoice fee owed to Sèvi Go under the current plan's metering rules —
// 0 once usage is within the plan's included allotment.
export function invoiceFeeForUsage(plan: SevigoPlan, invoicesUsedBeforeThis: number): number {
  if (plan.includedInvoices === null) return 0; // unlimited
  return invoicesUsedBeforeThis >= plan.includedInvoices ? plan.extraInvoiceFee : 0;
}
