-- Sèvizi — super-admin revenue dashboard & reports.
-- Run in Supabase → SQL Editor (idempotent).
--
-- Sèvizi's own income (cash actually collected through PayDunya, after any
-- discount code / referral credit):
--   pro          Sèvizi Pro memberships              pro_payments.amount
--   sevigo_plan  Sèvi Go monthly plans               sevigo_plan_payments.amount
--   sevigo_fee   Sèvi Go per-invoice generation fee  sevigo_invoice_generation_fees.amount
--   sevigo_comm  Sèvi Go commission on client pay    sevigo_invoice_payments.sevigo_fee
--   job_comm     Marketplace commission on jobs      job_payments.commission
-- Not income: job/invoice amounts that pass through to the provider, and
-- appointment deposits (no commission is kept on those).
-- Only completed payments count. Money covered by referral credit or a
-- discount code is reported separately ("covered") — it's not cash.
--
-- Super admin only, enforced inside the function (SECURITY DEFINER bypasses
-- RLS, so the check is the whole gate).

create or replace function admin_revenue_report(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql security definer as $$
declare
  v_days int := greatest(1, ceil(extract(epoch from (p_to - p_from)) / 86400)::int);
  v_unit text := case when ceil(extract(epoch from (p_to - p_from)) / 86400) <= 92 then 'day' else 'month' end;
  v_streams jsonb; v_series jsonb; v_tx jsonb; v_covered jsonb; v_active jsonb; v_volume jsonb; v_pending jsonb;
begin
  if not is_super_admin() then raise exception 'Réservé aux super admins.'; end if;

  drop table if exists _rev;
  create temp table _rev (at timestamptz, stream text, who text, amount int, uid uuid) on commit drop;

  insert into _rev
  select p.confirmed_at, 'pro', coalesce(pr.name, pf.full_name, '—'), p.amount, p.user_id
    from pro_payments p
    left join providers pr on pr.id = p.provider_id
    left join profiles pf on pf.id = p.user_id
    where p.status = 'completed' and p.amount > 0 and p.confirmed_at >= p_from and p.confirmed_at < p_to;

  insert into _rev
  select p.confirmed_at, 'sevigo_plan', coalesce(pf.full_name, '—') || ' · ' || initcap(p.plan_id), p.amount, p.user_id
    from sevigo_plan_payments p left join profiles pf on pf.id = p.user_id
    where p.status = 'completed' and p.amount > 0 and p.confirmed_at >= p_from and p.confirmed_at < p_to;

  insert into _rev
  select p.confirmed_at, 'sevigo_fee', coalesce(pf.full_name, '—'), p.amount, p.user_id
    from sevigo_invoice_generation_fees p left join profiles pf on pf.id = p.user_id
    where p.status = 'completed' and p.amount > 0 and p.confirmed_at >= p_from and p.confirmed_at < p_to;

  insert into _rev
  select p.confirmed_at, 'sevigo_comm', coalesce(pf.full_name, '—'), p.sevigo_fee, p.user_id
    from sevigo_invoice_payments p left join profiles pf on pf.id = p.user_id
    where p.status = 'completed' and p.sevigo_fee > 0 and p.confirmed_at >= p_from and p.confirmed_at < p_to;

  insert into _rev
  select p.confirmed_at, 'job_comm', coalesce(pr.name, '—'), p.commission, pr.user_id
    from job_payments p left join providers pr on pr.id = p.provider_id
    where p.status = 'completed' and p.commission > 0 and p.confirmed_at >= p_from and p.confirmed_at < p_to;

  select coalesce(jsonb_agg(jsonb_build_object('stream', s.stream, 'amount', coalesce(r.amt, 0), 'count', coalesce(r.n, 0)) order by s.ord), '[]'::jsonb)
    into v_streams
    from (values ('pro',1),('sevigo_plan',2),('sevigo_fee',3),('sevigo_comm',4),('job_comm',5)) s(stream, ord)
    left join (select stream, sum(amount) amt, count(*) n from _rev group by stream) r on r.stream = s.stream;

  select coalesce(jsonb_agg(jsonb_build_object(
      'bucket', to_char(b.bucket, case when v_unit = 'day' then 'YYYY-MM-DD' else 'YYYY-MM' end),
      'total', coalesce(r.total, 0),
      'pro', coalesce(r.pro, 0), 'sevigo_plan', coalesce(r.sp, 0), 'sevigo_fee', coalesce(r.sf, 0),
      'sevigo_comm', coalesce(r.sc, 0), 'job_comm', coalesce(r.jc, 0)) order by b.bucket), '[]'::jsonb)
    into v_series
    from generate_series(date_trunc(v_unit, p_from), date_trunc(v_unit, p_to - interval '1 second'), ('1 ' || v_unit)::interval) b(bucket)
    left join (
      select date_trunc(v_unit, at) bucket, sum(amount) total,
        sum(amount) filter (where stream = 'pro') pro, sum(amount) filter (where stream = 'sevigo_plan') sp,
        sum(amount) filter (where stream = 'sevigo_fee') sf, sum(amount) filter (where stream = 'sevigo_comm') sc,
        sum(amount) filter (where stream = 'job_comm') jc
      from _rev group by 1) r on r.bucket = b.bucket;

  select coalesce(jsonb_agg(jsonb_build_object('at', at, 'stream', stream, 'who', who, 'amount', amount) order by at desc), '[]'::jsonb)
    into v_tx from (select * from _rev order by at desc limit 1000) t;

  v_covered := jsonb_build_object(
    'credit',
      coalesce((select sum(referral_credit_applied) from pro_payments where status = 'completed' and confirmed_at >= p_from and confirmed_at < p_to), 0)
      + coalesce((select sum(referral_credit_applied) from sevigo_plan_payments where status = 'completed' and confirmed_at >= p_from and confirmed_at < p_to), 0)
      + coalesce((select sum(referral_credit_applied) from sevigo_invoice_generation_fees where status = 'completed' and confirmed_at >= p_from and confirmed_at < p_to), 0),
    'discounts', coalesce((select sum(discount_amount) from pro_payments where status = 'completed' and confirmed_at >= p_from and confirmed_at < p_to), 0));

  v_volume := jsonb_build_object(
    'jobs', coalesce((select sum(amount) from job_payments where status = 'completed' and confirmed_at >= p_from and confirmed_at < p_to), 0),
    'invoices', coalesce((select sum(amount) from sevigo_invoice_payments where status = 'completed' and confirmed_at >= p_from and confirmed_at < p_to), 0),
    'deposits', coalesce((select sum(deposit_amount) from appointments where deposit_status = 'completed' and confirmed_at >= p_from and confirmed_at < p_to), 0));

  v_pending := jsonb_build_object(
    'count',
      (select count(*) from pro_payments where status = 'pending' and created_at >= now() - interval '2 days')
      + (select count(*) from sevigo_plan_payments where status = 'pending' and created_at >= now() - interval '2 days'),
    'amount',
      coalesce((select sum(amount) from pro_payments where status = 'pending' and created_at >= now() - interval '2 days'), 0)
      + coalesce((select sum(amount) from sevigo_plan_payments where status = 'pending' and created_at >= now() - interval '2 days'), 0));

  v_active := jsonb_build_object(
    'sevigo_paid', (select count(*) from sevigo_subscriptions where plan_id <> 'payg' and plan_source = 'paid' and (plan_expires_at is null or plan_expires_at > now())),
    'sevigo_free', (select count(*) from sevigo_subscriptions where plan_id <> 'payg' and plan_source = 'granted' and (plan_expires_at is null or plan_expires_at > now())),
    'sevigo_mrr', coalesce((select sum(case plan_id when 'starter' then 2000 when 'growth' then 5000 when 'unlimited' then 10000 else 0 end)
        from sevigo_subscriptions where plan_id <> 'payg' and plan_source = 'paid' and (plan_expires_at is null or plan_expires_at > now())), 0),
    'pro_providers', (select count(*) from providers where tier <> 'free'),
    'users', (select count(*) from profiles),
    'providers', (select count(*) from providers));

  return jsonb_build_object(
    'from', p_from, 'to', p_to, 'unit', v_unit, 'days', v_days,
    'total', coalesce((select sum(amount) from _rev), 0),
    'streams', v_streams, 'series', v_series, 'transactions', v_tx,
    'covered', v_covered, 'volume', v_volume, 'pending', v_pending, 'active', v_active);
end; $$;
revoke all on function admin_revenue_report(timestamptz, timestamptz) from public, anon;
grant execute on function admin_revenue_report(timestamptz, timestamptz) to authenticated;
