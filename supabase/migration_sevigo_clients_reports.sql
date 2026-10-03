-- Sèvi Go — client file (Unlimited) and reports & analytics (paid plans)
-- Run in Supabase → SQL Editor (idempotent). Needs migration_sevigo_pos.sql.
--
-- Clients: a per-business address book. A saved client can be attached to a
-- till sale and to an invoice, so each client has a purchase history and a
-- total spent. Writing requires the Unlimited plan (same sevigo_has_pos gate
-- as the rest of the POS); a business always reads only its own rows.
--
-- Reports: sevigo_report() aggregates on the server (so it stays fast with
-- thousands of rows) and is limited to the caller's own data. Invoice
-- analytics need any paid plan; the till section is added only for Unlimited.

create table if not exists sevigo_clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  phone text check (phone is null or char_length(phone) <= 30),
  email text check (email is null or char_length(email) <= 120),
  address text check (address is null or char_length(address) <= 200),
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz default now()
);
create index if not exists sevigo_clients_user_idx on sevigo_clients(user_id, name);
alter table sevigo_clients enable row level security;
drop policy if exists "own clients read" on sevigo_clients;
create policy "own clients read" on sevigo_clients for select using (auth.uid() = user_id);
drop policy if exists "own clients insert" on sevigo_clients;
create policy "own clients insert" on sevigo_clients for insert
  with check (auth.uid() = user_id and sevigo_has_pos(auth.uid()));
drop policy if exists "own clients update" on sevigo_clients;
create policy "own clients update" on sevigo_clients for update
  using (auth.uid() = user_id and sevigo_has_pos(auth.uid())) with check (auth.uid() = user_id);
drop policy if exists "own clients delete" on sevigo_clients;
create policy "own clients delete" on sevigo_clients for delete
  using (auth.uid() = user_id and sevigo_has_pos(auth.uid()));

alter table sevigo_sales add column if not exists client_id uuid references sevigo_clients(id) on delete set null;
alter table sevigo_invoices add column if not exists client_id uuid references sevigo_clients(id) on delete set null;
create index if not exists sevigo_sales_client_idx on sevigo_sales(client_id);
create index if not exists sevigo_invoices_client_idx on sevigo_invoices(client_id);

-- An invoice/sale may only point at one of the caller's own clients.
create or replace function enforce_own_sevigo_client() returns trigger
language plpgsql security definer as $$
begin
  if new.client_id is not null and not exists (
    select 1 from sevigo_clients where id = new.client_id and user_id = new.user_id
  ) then
    new.client_id := null;
  end if;
  return new;
end; $$;
drop trigger if exists trg_own_client_invoices on sevigo_invoices;
create trigger trg_own_client_invoices before insert or update of client_id on sevigo_invoices
  for each row execute function enforce_own_sevigo_client();

-- Same till function, now with an optional saved client.
drop function if exists sevigo_create_sale(jsonb, text);
create or replace function sevigo_create_sale(p_items jsonb, p_method text, p_client_id uuid default null) returns json
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
  if p_client_id is not null and not exists (select 1 from sevigo_clients where id = p_client_id and user_id = v_uid) then
    raise exception 'Client introuvable.';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100 then
    raise exception 'Panier vide.';
  end if;

  perform pg_advisory_xact_lock(hashtext('sevigo_sale:' || v_uid::text));
  select coalesce(max(seq), 0) + 1 into v_seq from sevigo_sales where user_id = v_uid;
  insert into sevigo_sales (user_id, seq, number, payment_method, client_id)
  values (v_uid, v_seq, 'V-' || lpad(v_seq::text, 4, '0'), p_method, p_client_id)
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
revoke all on function sevigo_create_sale(jsonb, text, uuid) from public, anon;
grant execute on function sevigo_create_sale(jsonb, text, uuid) to authenticated;

-- ---- Reports ----
create or replace function sevigo_report(p_from timestamptz, p_to timestamptz) returns json
language plpgsql security definer stable as $$
declare
  v_uid uuid := auth.uid();
  v_plan text;
  v_inv json;
  v_pos json := null;
  v_days int := least(greatest((p_to::date - p_from::date), 1), 366);
begin
  if v_uid is null then raise exception 'Non connecté'; end if;
  select plan_id into v_plan from sevigo_subscriptions where user_id = v_uid;
  if coalesce(v_plan, 'payg') not in ('starter', 'growth', 'unlimited') then
    raise exception 'Les rapports sont réservés aux formules payantes.';
  end if;

  select json_build_object(
    'invoiced_count', (select count(*) from sevigo_invoices where user_id = v_uid and status not in ('pending_fee','cancelled') and created_at >= p_from and created_at < p_to),
    'invoiced_total', (select coalesce(sum(total),0) from sevigo_invoices where user_id = v_uid and status not in ('pending_fee','cancelled') and created_at >= p_from and created_at < p_to),
    'paid_count',     (select count(*) from sevigo_invoices where user_id = v_uid and status = 'paid' and paid_at >= p_from and paid_at < p_to),
    'paid_total',     (select coalesce(sum(total),0) from sevigo_invoices where user_id = v_uid and status = 'paid' and paid_at >= p_from and paid_at < p_to),
    'outstanding_count', (select count(*) from sevigo_invoices where user_id = v_uid and status in ('sent','overdue')),
    'outstanding_total', (select coalesce(sum(total),0) from sevigo_invoices where user_id = v_uid and status in ('sent','overdue')),
    'overdue_count',  (select count(*) from sevigo_invoices where user_id = v_uid and status = 'overdue'),
    'top_clients', (select coalesce(json_agg(t), '[]'::json) from (
        select client_name as name, sum(total)::int as total, count(*)::int as count
        from sevigo_invoices
        where user_id = v_uid and status not in ('pending_fee','cancelled') and created_at >= p_from and created_at < p_to
        group by client_name order by sum(total) desc limit 5) t),
    'series', (select coalesce(json_agg(s order by s.day), '[]'::json) from (
        select d::date as day,
          coalesce((select sum(total) from sevigo_invoices where user_id = v_uid and status not in ('pending_fee','cancelled') and created_at::date = d::date), 0)::int as invoiced,
          coalesce((select sum(total) from sevigo_invoices where user_id = v_uid and status = 'paid' and paid_at::date = d::date), 0)::int as paid
        from generate_series(p_from::date, p_from::date + v_days, interval '1 day') d
        where d::date < p_to::date) s)
  ) into v_inv;

  if v_plan = 'unlimited' then
    select json_build_object(
      'sales_count', (select count(*) from sevigo_sales where user_id = v_uid and status = 'completed' and created_at >= p_from and created_at < p_to),
      'sales_total', (select coalesce(sum(total),0) from sevigo_sales where user_id = v_uid and status = 'completed' and created_at >= p_from and created_at < p_to),
      'cash_total',  (select coalesce(sum(total),0) from sevigo_sales where user_id = v_uid and status = 'completed' and payment_method = 'cash' and created_at >= p_from and created_at < p_to),
      'mobile_total',(select coalesce(sum(total),0) from sevigo_sales where user_id = v_uid and status = 'completed' and payment_method = 'mobile' and created_at >= p_from and created_at < p_to),
      'voided_count',(select count(*) from sevigo_sales where user_id = v_uid and status = 'voided' and created_at >= p_from and created_at < p_to),
      'low_stock_count', (select count(*) from sevigo_products where user_id = v_uid and active and stock <= low_stock_threshold),
      'top_products', (select coalesce(json_agg(t), '[]'::json) from (
          select i.name, sum(i.qty)::int as qty, sum(i.line_total)::int as revenue
          from sevigo_sale_items i join sevigo_sales s on s.id = i.sale_id
          where s.user_id = v_uid and s.status = 'completed' and s.created_at >= p_from and s.created_at < p_to
          group by i.name order by sum(i.line_total) desc limit 5) t),
      'series', (select coalesce(json_agg(s order by s.day), '[]'::json) from (
          select d::date as day,
            coalesce((select sum(total) from sevigo_sales where user_id = v_uid and status = 'completed' and created_at::date = d::date), 0)::int as total
          from generate_series(p_from::date, p_from::date + v_days, interval '1 day') d
          where d::date < p_to::date) s)
    ) into v_pos;
  end if;

  return json_build_object('plan', v_plan, 'invoices', v_inv, 'pos', v_pos);
end; $$;
revoke all on function sevigo_report(timestamptz, timestamptz) from public, anon;
grant execute on function sevigo_report(timestamptz, timestamptz) to authenticated;
