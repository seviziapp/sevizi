// Sèvi Go — POS & inventory API (Unlimited plan). Separate from invoicing:
// nothing here touches invoices, the invoice quota or fees. Sales are written
// only through the sevigo_create_sale / sevigo_void_sale RPCs, which price
// the cart from the products table and check stock server-side — the client
// sends only product ids and quantities. See supabase/migration_sevigo_pos.sql.
import { supabase } from '../supabase';
import { hasSupabase, currentUser } from '../api/shared';
import { reportError } from '../reportError';

export type SevigoProduct = {
  id: string;
  name: string;
  price: number;
  stock: number;
  lowStockThreshold: number;
  photoUrl?: string;
  active: boolean;
};

export type SevigoSale = {
  id: string;
  number: string;
  total: number;
  paymentMethod: 'cash' | 'mobile';
  status: 'completed' | 'voided';
  createdAt: string;
  clientName?: string;
  items?: { name: string; unitPrice: number; qty: number; lineTotal: number }[];
};

export const isLowStock = (p: Pick<SevigoProduct, 'stock' | 'lowStockThreshold'>) => p.stock <= p.lowStockThreshold;

function mapProduct(r: any): SevigoProduct {
  return {
    id: r.id, name: r.name, price: r.price, stock: r.stock,
    lowStockThreshold: r.low_stock_threshold, photoUrl: r.photo_url ?? undefined, active: !!r.active,
  };
}

export async function fetchProducts(includeArchived = false): Promise<SevigoProduct[]> {
  if (!hasSupabase) return [];
  let q = supabase.from('sevigo_products').select('*').order('name', { ascending: true });
  if (!includeArchived) q = q.eq('active', true);
  const { data, error } = await q;
  if (error) { reportError(error); return []; }
  return (data ?? []).map(mapProduct);
}

export async function saveProduct(input: {
  id?: string; name: string; price: number; stock: number; lowStockThreshold: number; photoUrl?: string | null;
}): Promise<void> {
  if (!hasSupabase) return;
  const user = await currentUser();
  if (!user) throw new Error('Non connecté');
  const row = {
    name: input.name.trim(), price: Math.round(input.price), stock: Math.round(input.stock),
    low_stock_threshold: Math.round(input.lowStockThreshold), photo_url: input.photoUrl ?? null,
  };
  const { error } = input.id
    ? await supabase.from('sevigo_products').update(row).eq('id', input.id)
    : await supabase.from('sevigo_products').insert({ ...row, user_id: user.id });
  if (error) throw new Error(error.message);
}

export async function adjustStock(productId: string, newStock: number): Promise<void> {
  if (!hasSupabase) return;
  const { error } = await supabase.from('sevigo_products').update({ stock: Math.max(0, Math.round(newStock)) }).eq('id', productId);
  if (error) throw new Error(error.message);
}

// Archived products drop out of the till and stock list but stay in past sales.
export async function archiveProduct(productId: string, active = false): Promise<void> {
  if (!hasSupabase) return;
  const { error } = await supabase.from('sevigo_products').update({ active }).eq('id', productId);
  if (error) throw new Error(error.message);
}

export async function createSale(
  items: { productId: string; qty: number }[], paymentMethod: 'cash' | 'mobile', clientId?: string | null,
): Promise<{ id: string; number: string; total: number }> {
  const { data, error } = await supabase.rpc('sevigo_create_sale', { p_items: items, p_method: paymentMethod, p_client_id: clientId ?? null });
  if (error) throw new Error(error.message);
  return data;
}

export async function voidSale(saleId: string): Promise<void> {
  const { error } = await supabase.rpc('sevigo_void_sale', { p_sale_id: saleId });
  if (error) throw new Error(error.message);
}

export async function fetchSales(limit = 100): Promise<SevigoSale[]> {
  if (!hasSupabase) return [];
  const { data, error } = await supabase
    .from('sevigo_sales').select('*, sevigo_clients(name), sevigo_sale_items(name, unit_price, qty, line_total)')
    .order('created_at', { ascending: false }).limit(limit);
  if (error) { reportError(error); return []; }
  return (data ?? []).map((s: any) => ({
    id: s.id, number: s.number, total: s.total, paymentMethod: s.payment_method, status: s.status,
    createdAt: s.created_at, clientName: s.sevigo_clients?.name ?? undefined,
    items: (s.sevigo_sale_items ?? []).map((i: any) => ({ name: i.name, unitPrice: i.unit_price, qty: i.qty, lineTotal: i.line_total })),
  }));
}
