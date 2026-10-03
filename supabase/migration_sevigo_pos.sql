-- Sèvi Go — POS & inventory (Unlimited plan)
-- Run in Supabase → SQL Editor (idempotent). Requires
-- migration_protect_sevigo_subscription.sql (so the plan check can be trusted).
--
-- Deliberately separate from invoicing: sales are NOT invoices, never touch
-- sevigo_invoices / invoices_this_cycle / generation fees, and have no
-- PayDunya step — the seller records how they were paid (cash, or mobile
-- money received on their own number) at the till.
--
-- Sales are written ONLY through sevigo_create_sale / sevigo_void_sale
-- (SECURITY DEFINER): prices come from the products table (never from the
-- client), stock is checked and decremented in the same transaction, and a
-- sale that can't be fully covered by stock fails as a whole.

create or replace function sevigo_has_pos(p_user_id uuid) returns boolean
language sql security definer stable as $$
  select exists (select 1 from sevigo_subscriptions where user_id = p_user_id and plan_id = 'unlimited');
$$;

-- ---- Products / stock ----
create table if not exists sevigo_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  price int not null check (price between 0 and 100000000),
  stock int not null default 0 check (stock >= 0),
  low_stock_threshold int not null default 5 check (low_stock_threshold >= 0),
  photo_url text,
  active boolean not null default true,   -- archived products stay in sales history
  created_at timestamptz default now()
);
create index if not exists sevigo_products_user_idx on sevigo_products(user_id);
alter table sevigo_products enable row level security;
drop policy if exists "own products read" on sevigo_products;
create policy "own products read" on sevigo_products for select using (auth.uid() = user_id);
drop policy if exists "own products insert" on sevigo_products;
create policy "own products insert" on sevigo_products for insert
  with check (auth.uid() = user_id and sevigo_has_pos(auth.uid()));
drop policy if exists "own products update" on sevigo_products;
create policy "own products update" on sevigo_products for update
  using (auth.uid() = user_id and sevigo_has_pos(auth.uid()))
  with check (auth.uid() = user_id);

-- ---- Sales ----
create table if not exists sevigo_sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  seq int not null,
  number text not null,
  total int not null default 0,
  payment_method text not null check (payment_method in ('cash', 'mobile')),
  status text not null default 'completed' check (status in ('completed', 'voided')),
  created_at timestamptz default now(),
  voided_at timestamptz,
  unique (user_id, seq)
);
create table if not exists sevigo_sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sevigo_sales(id) on delete cascade,
  product_id uuid references sevigo_products(id) on delete set null,
  name text not null,
  unit_price int not null,
  qty int not null check (qty > 0),
  line_total int not null
);
create index if not exists sevigo_sales_user_idx on sevigo_sales(user_id, created_at desc);
create index if not exists sevigo_sale_items_sale_idx on sevigo_sale_items(sale_id);
alter table sevigo_sales enable row level security;
alter table sevigo_sale_items enable row level security;
drop policy if exists "own sales read" on sevigo_sales;
create policy "own sales read" on sevigo_sales for select using (auth.uid() = user_id);
drop policy if exists "own sale items read" on sevigo_sale_items;
create policy "own sale items read" on sevigo_sale_items for select
  using (exists (select 1 from sevigo_sales s where s.id = sale_id and s.user_id = auth.uid()));
-- No insert/update/delete policies: only the two functions below write here.

create or replace function sevigo_create_sale(p_items jsonb, p_method text) returns json
language plpgsql security definer as $$
declare
  v_uid uuid := auth.uid();
  v_sale_id uuid;
  v_seq int;
  v_total int := 0;
  v_item jsonb;
  v_qty int;
  v_prod sevigo_products%rowtype;
begin
  if v_uid is null then raise exception 'Non connecté'; end if;
  if not sevigo_has_pos(v_uid) then
    raise exception 'La caisse est réservée à la formule Unlimited.';
  end if;
  if p_method not in ('cash', 'mobile') then raise exception 'Mode de paiement invalide.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100 then
    raise exception 'Panier vide.';
  end if;

  perform pg_advisory_xact_lock(hashtext('sevigo_sale:' || v_uid::text));
  select coalesce(max(seq), 0) + 1 into v_seq from sevigo_sales where user_id = v_uid;
  insert into sevigo_sales (user_id, seq, number, payment_method)
  values (v_uid, v_seq, 'V-' || lpad(v_seq::text, 4, '0'), p_method)
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item ->> 'qty')::int;
    if v_qty is null or v_qty <= 0 or v_qty > 10000 then raise exception 'Quantité invalide.'; end if;
    select * into v_prod from sevigo_products
      where id = (v_item ->> 'productId')::uuid and user_id = v_uid and active
      for update;
    if not found then raise exception 'Produit introuvable ou archivé.'; end if;
    if v_prod.stock < v_qty then
      raise exception 'Stock insuffisant pour « % » (reste %).', v_prod.name, v_prod.stock;
    end if;
    update sevigo_products set stock = stock - v_qty where id = v_prod.id;
    insert into sevigo_sale_items (sale_id, product_id, name, unit_price, qty, line_total)
    values (v_sale_id, v_prod.id, v_prod.name, v_prod.price, v_qty, v_prod.price * v_qty);
    v_total := v_total + v_prod.price * v_qty;
  end loop;

  update sevigo_sales set total = v_total where id = v_sale_id;
  return json_build_object('id', v_sale_id, 'number', 'V-' || lpad(v_seq::text, 4, '0'), 'total', v_total);
end; $$;

-- Cancels a sale made by mistake and puts the stock back.
create or replace function sevigo_void_sale(p_sale_id uuid) returns void
language plpgsql security definer as $$
declare
  v_uid uuid := auth.uid();
  v_sale sevigo_sales%rowtype;
begin
  if v_uid is null then raise exception 'Non connecté'; end if;
  select * into v_sale from sevigo_sales where id = p_sale_id and user_id = v_uid for update;
  if not found then raise exception 'Vente introuvable.'; end if;
  if v_sale.status <> 'completed' then raise exception 'Cette vente est déjà annulée.'; end if;
  update sevigo_products p set stock = p.stock + i.qty
    from sevigo_sale_items i where i.sale_id = p_sale_id and i.product_id = p.id;
  update sevigo_sales set status = 'voided', voided_at = now() where id = p_sale_id;
end; $$;

revoke all on function sevigo_create_sale(jsonb, text) from public, anon;
revoke all on function sevigo_void_sale(uuid) from public, anon;
grant execute on function sevigo_create_sale(jsonb, text) to authenticated;
grant execute on function sevigo_void_sale(uuid) to authenticated;
