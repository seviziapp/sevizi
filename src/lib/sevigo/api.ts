// Sèvi Go — API layer. Talks to the sevigo_* tables (supabase/migration_sevigo.sql).
// Falls back to local demo data whenever those tables don't exist yet (error
// 42P01 = undefined_table) so the UI works immediately, before the migration
// is applied — same graceful-degrade shape the rest of the app uses via
// `hasSupabase`, just keyed off "this specific table is missing" instead.
import { supabase } from '../supabase';
import { hasSupabase, currentUser } from '../api/shared';
import {
  SevigoInvoice, SevigoLineItem, SevigoBusinessProfile, SevigoUsage,
  SevigoPlanId, SevigoInvoiceTemplate, computeInvoiceTotals, planById,
} from './types';

const TABLE_MISSING = '42P01';

function isTableMissing(error: any): boolean {
  return error?.code === TABLE_MISSING;
}

// -- Demo data (used pre-migration or when Supabase isn't configured) --

const demoInvoices: SevigoInvoice[] = [
  {
    id: 'demo-1', number: 'INV-0001', clientName: 'Ets. Mensah & Fils', clientEmail: 'contact@mensah.tg',
    items: [
      { id: 'i1', description: 'Installation électrique — bureau', quantity: 1, unitPrice: 85000 },
      { id: 'i2', description: 'Câble 2.5mm (rouleau)', quantity: 3, unitPrice: 12000 },
    ],
    subtotal: 121000, total: 121000, status: 'paid', template: 'classic',
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: 'demo-2', number: 'INV-0002', clientName: 'Ama Coiffure', clientEmail: 'ama.coiffure@gmail.com',
    items: [{ id: 'i1', description: 'Tresses + soin', quantity: 1, unitPrice: 15000, discountPct: 10 }],
    subtotal: 13500, total: 13500, status: 'sent', template: 'modern',
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    dueDate: new Date(Date.now() + 5 * 86400000).toISOString(),
  },
];

const demoUsage: SevigoUsage = { planId: 'payg', cycleStart: new Date().toISOString(), invoicesThisCycle: demoInvoices.length };

function mapInvoiceRow(row: any, items: any[]): SevigoInvoice {
  return {
    id: row.id,
    number: row.number,
    clientName: row.client_name,
    clientContact: row.client_contact ?? undefined,
    clientEmail: row.client_email ?? undefined,
    items: items.map(mapLineItemRow),
    discountPct: row.discount_pct ?? undefined,
    discountFlat: row.discount_flat ?? undefined,
    subtotal: row.subtotal,
    total: row.total,
    status: row.status,
    template: row.template,
    createdAt: row.created_at,
    dueDate: row.due_date,
    paymentUrl: row.payment_url,
    notes: row.notes ?? undefined,
  };
}

function mapLineItemRow(row: any): SevigoLineItem {
  return {
    id: row.id,
    description: row.description,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    discountPct: row.discount_pct ?? undefined,
  };
}

export async function fetchSevigoUsage(): Promise<SevigoUsage> {
  if (!hasSupabase) return demoUsage;
  const user = await currentUser();
  if (!user) return demoUsage;
  const { data, error } = await supabase
    .from('sevigo_subscriptions')
    .select('plan_id, cycle_start, invoices_this_cycle')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error && !isTableMissing(error)) throw error;
  if (!data) return { planId: 'payg', cycleStart: new Date().toISOString(), invoicesThisCycle: 0 };
  return { planId: data.plan_id, cycleStart: data.cycle_start, invoicesThisCycle: data.invoices_this_cycle };
}

export async function setSevigoPlan(planId: SevigoPlanId): Promise<void> {
  if (!hasSupabase) return;
  const user = await currentUser();
  if (!user) throw new Error('Non connecté');
  const { error } = await supabase
    .from('sevigo_subscriptions')
    .upsert({ user_id: user.id, plan_id: planId }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function fetchSevigoBusinessProfile(): Promise<SevigoBusinessProfile | null> {
  if (!hasSupabase) return null;
  const user = await currentUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('sevigo_business_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error && !isTableMissing(error)) throw error;
  if (!data) return null;
  return {
    businessName: data.business_name,
    logoUrl: data.logo_url,
    brandColor: data.brand_color,
    contactEmail: data.contact_email ?? undefined,
    contactPhone: data.contact_phone ?? undefined,
    address: data.address ?? undefined,
  };
}

export async function saveSevigoBusinessProfile(profile: SevigoBusinessProfile): Promise<void> {
  if (!hasSupabase) return;
  const user = await currentUser();
  if (!user) throw new Error('Non connecté');
  const { error } = await supabase.from('sevigo_business_profiles').upsert({
    user_id: user.id,
    business_name: profile.businessName,
    logo_url: profile.logoUrl ?? null,
    brand_color: profile.brandColor ?? null,
    contact_email: profile.contactEmail ?? null,
    contact_phone: profile.contactPhone ?? null,
    address: profile.address ?? null,
  }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function fetchSevigoInvoices(): Promise<SevigoInvoice[]> {
  if (!hasSupabase) return demoInvoices;
  const user = await currentUser();
  if (!user) return demoInvoices;
  const { data, error } = await supabase
    .from('sevigo_invoices')
    .select('*, sevigo_invoice_items(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) {
    if (isTableMissing(error)) return demoInvoices;
    throw error;
  }
  return (data ?? []).map((row: any) => mapInvoiceRow(row, row.sevigo_invoice_items ?? []));
}

export async function fetchSevigoInvoice(id: string): Promise<SevigoInvoice | null> {
  if (!hasSupabase || id.startsWith('demo-')) return demoInvoices.find(i => i.id === id) ?? null;
  const { data, error } = await supabase
    .from('sevigo_invoices')
    .select('*, sevigo_invoice_items(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    if (isTableMissing(error)) return demoInvoices.find(i => i.id === id) ?? null;
    throw error;
  }
  if (!data) return null;
  return mapInvoiceRow(data, data.sevigo_invoice_items ?? []);
}

export interface CreateSevigoInvoiceInput {
  clientName: string;
  clientContact?: string;
  clientEmail?: string;
  items: Omit<SevigoLineItem, 'id'>[];
  discountPct?: number;
  discountFlat?: number;
  template: SevigoInvoiceTemplate;
  dueDate?: string | null;
  notes?: string;
}

export async function createSevigoInvoice(input: CreateSevigoInvoiceInput): Promise<SevigoInvoice> {
  const items: SevigoLineItem[] = input.items.map((it, i) => ({ ...it, id: `local-${i}` }));
  const { subtotal, total } = computeInvoiceTotals(items, input.discountPct, input.discountFlat);

  if (!hasSupabase) {
    return {
      id: `demo-${Date.now()}`, number: `INV-${String(demoInvoices.length + 1).padStart(4, '0')}`,
      clientName: input.clientName, clientContact: input.clientContact, clientEmail: input.clientEmail,
      items, discountPct: input.discountPct, discountFlat: input.discountFlat,
      subtotal, total, status: 'draft', template: input.template,
      createdAt: new Date().toISOString(), dueDate: input.dueDate, notes: input.notes,
    };
  }
  const user = await currentUser();
  if (!user) throw new Error('Non connecté');

  // Invoice number: next sequential per-user, computed client-side from the
  // current count. A concurrent double-submit could in theory collide; low
  // risk for a single-owner invoicing flow, and cheap to harden later with a
  // DB sequence/trigger if it ever matters.
  const { count } = await supabase
    .from('sevigo_invoices')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);
  const number = `INV-${String((count ?? 0) + 1).padStart(4, '0')}`;

  const { data: invRow, error: invErr } = await supabase
    .from('sevigo_invoices')
    .insert({
      user_id: user.id, number,
      client_name: input.clientName, client_contact: input.clientContact ?? null, client_email: input.clientEmail ?? null,
      discount_pct: input.discountPct ?? null, discount_flat: input.discountFlat ?? null,
      subtotal, total, status: 'draft', template: input.template,
      due_date: input.dueDate ?? null, notes: input.notes ?? null,
    })
    .select()
    .single();
  if (invErr) throw invErr;

  const { data: itemRows, error: itemErr } = await supabase
    .from('sevigo_invoice_items')
    .insert(input.items.map(it => ({
      invoice_id: invRow.id, description: it.description, quantity: it.quantity,
      unit_price: it.unitPrice, discount_pct: it.discountPct ?? null,
    })))
    .select();
  if (itemErr) throw itemErr;

  return mapInvoiceRow(invRow, itemRows ?? []);
}

export async function updateSevigoInvoiceStatus(id: string, status: SevigoInvoice['status']): Promise<void> {
  if (!hasSupabase || id.startsWith('demo-')) return;
  const { error } = await supabase.from('sevigo_invoices').update({ status }).eq('id', id);
  if (error) throw error;
}

// Requests a PayDunya payment link for an invoice via the sevigo-create-invoice-payment
// edge function (splits Sèvi Go's plan-tier fee off the top before payout).
export async function createSevigoInvoicePayment(invoiceId: string, returnUrl: string, cancelUrl: string): Promise<{ invoiceUrl: string }> {
  const { data, error } = await supabase.functions.invoke('sevigo-create-invoice-payment', {
    body: { invoiceId, returnUrl, cancelUrl },
  });
  if (error) throw error;
  return data;
}
