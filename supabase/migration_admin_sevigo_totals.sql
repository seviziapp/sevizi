-- Sèvizi — super-admin Sèvi Go totals (aggregates only).
-- Shows how much Sèvi Go is used (businesses, invoices, till sales, volume) without
-- exposing any individual invoice, sale or client. Business names are shown only
-- in the "top businesses" ranking, with their counts and amounts.
create or replace function admin_sevigo_totals(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_res jsonb;
begin
  if not is_super_admin() then raise exception 'Réservé aux super admins.'; end if;

  select jsonb_build_object(
    'businesses', jsonb_build_object(
      'total', (select count(*) from sevigo_business_profiles),
      'new', (select count(*) from sevigo_business_profiles where updated_at >= p_from and updated_at < p_to),
      'active', (select count(distinct user_id) from (
          select user_id from sevigo_invoices where created_at >= p_from and created_at < p_to
          union all
          select user_id from sevigo_sales where created_at >= p_from and created_at < p_to
        ) x)
    ),
    'invoices', (select jsonb_build_object(
        'created', count(*),
        'paid', count(*) filter (where status = 'paid'),
        'total_amount', coalesce(sum(total), 0),
        'paid_amount', coalesce(sum(total) filter (where status = 'paid'), 0))
      from sevigo_invoices where created_at >= p_from and created_at < p_to),
    'till', (select jsonb_build_object(
        'sales', count(*) filter (where status = 'completed'),
        'amount', coalesce(sum(total) filter (where status = 'completed'), 0),
        'cash', coalesce(sum(total) filter (where status = 'completed' and payment_method = 'cash'), 0),
        'mobile', coalesce(sum(total) filter (where status = 'completed' and payment_method = 'mobile'), 0))
      from sevigo_sales where created_at >= p_from and created_at < p_to),
    'top', coalesce((select jsonb_agg(t order by t.amount desc) from (
        select coalesce(b.business_name, '—') as name,
               count(*) filter (where k = 'invoice') as invoices,
               count(*) filter (where k = 'sale') as sales,
               sum(amt) as amount
          from (
            select user_id, 'invoice' as k, total as amt from sevigo_invoices
              where created_at >= p_from and created_at < p_to and status <> 'cancelled'
            union all
            select user_id, 'sale', total from sevigo_sales
              where created_at >= p_from and created_at < p_to and status = 'completed'
          ) u
          left join sevigo_business_profiles b on b.user_id = u.user_id
          group by u.user_id, b.business_name
          order by sum(amt) desc limit 10
      ) t), '[]'::jsonb)
  ) into v_res;
  return v_res;
end; $$;
grant execute on function admin_sevigo_totals(timestamptz, timestamptz) to authenticated;
