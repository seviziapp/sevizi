// Sèvi Go — client file (Unlimited plan): a per-business address book. A saved
// client can be attached to a till sale and to an invoice, which gives each
// client a purchase history and a total spent. See
// supabase/migration_sevigo_clients_reports.sql.
import { supabase } from '../supabase';
import { hasSupabase, currentUser } from '../api/shared';
import { reportError } from '../reportError';

export type SevigoClient = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  createdAt: string;
};

export type ClientPurchase = {
  kind: 'sale' | 'invoice';
  id: string;
  label: string;      // "V-0003" / "INV-0012"
  total: number;
  status: string;
  createdAt: string;
  counted: boolean;   // counts toward total spent (completed sale / paid invoice)
};

function mapClient(r: any): SevigoClient {
  return {
    id: r.id, name: r.name, phone: r.phone ?? undefined, email: r.email ?? undefined,
    address: r.address ?? undefined, notes: r.notes ?? undefined, createdAt: r.created_at,
  };
}

export async function fetchClients(): Promise<SevigoClient[]> {
  if (!hasSupabase) return [];
  const { data, error } = await supabase.from('sevigo_clients').select('*').order('name', { ascending: true });
  if (error) { reportError(error); return []; }
  return (data ?? []).map(mapClient);
}

export async function saveClient(input: {
  id?: string; name: string; phone?: string; email?: string; address?: string; notes?: string;
}): Promise<SevigoClient> {
  const user = await currentUser();
  if (!user) throw new Error('Non connecté');
  const row = {
    name: input.name.trim(), phone: input.phone?.trim() || null, email: input.email?.trim() || null,
    address: input.address?.trim() || null, notes: input.notes?.trim() || null,
  };
  const q = input.id
    ? supabase.from('sevigo_clients').update(row).eq('id', input.id)
    : supabase.from('sevigo_clients').insert({ ...row, user_id: user.id });
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return mapClient(data);
}

// Reuses an existing saved client with the same name (and phone, when both
// have one) instead of creating a duplicate each time the same person is
// invoiced.
export async function findOrCreateClient(input: { name: string; phone?: string; email?: string }): Promise<SevigoClient> {
  const name = input.name.trim().toLowerCase();
  const phone = (input.phone ?? '').replace(/\s/g, '');
  const existing = (await fetchClients()).find(c =>
    c.name.trim().toLowerCase() === name && (!phone || !c.phone || c.phone.replace(/\s/g, '') === phone));
  return existing ?? saveClient(input);
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase.from('sevigo_clients').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// Everything this client bought: till sales + invoices, newest first.
export async function fetchClientHistory(clientId: string): Promise<ClientPurchase[]> {
  const [sales, invoices] = await Promise.all([
    supabase.from('sevigo_sales').select('id, number, total, status, created_at').eq('client_id', clientId),
    supabase.from('sevigo_invoices').select('id, number, total, status, created_at').eq('client_id', clientId),
  ]);
  if (sales.error) reportError(sales.error);
  if (invoices.error) reportError(invoices.error);
  const rows: ClientPurchase[] = [
    ...(sales.data ?? []).map((s: any): ClientPurchase => ({
      kind: 'sale', id: s.id, label: s.number, total: s.total, status: s.status, createdAt: s.created_at,
      counted: s.status === 'completed',
    })),
    ...(invoices.data ?? []).filter((i: any) => i.status !== 'pending_fee' && i.status !== 'cancelled').map((i: any): ClientPurchase => ({
      kind: 'invoice', id: i.id, label: i.number, total: i.total, status: i.status, createdAt: i.created_at,
      counted: i.status === 'paid',
    })),
  ];
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
