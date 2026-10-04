-- Sèvi Go — plan lifecycle: 30-day paid periods, expiry, renewal reminders,
-- monthly invoice-counter reset, and admin-granted free plans/trials.
-- Run in Supabase → SQL Editor (idempotent).
--
-- Before this, paying once for a "monthly" plan kept it forever (nothing
-- recorded an end date or downgraded it), and the included-invoice counter
-- never reset, so Starter/Growth users ran out of their quota for good.
--
-- Model (on sevigo_subscriptions):
--   plan_expires_at  end of the current period; NULL = no end (Pay As You Go,
--                    or a free plan granted with no end date)
--   plan_source      'paid' (customer paid PayDunya) | 'granted' (admin gave it)
--   reminded_for     the plan_expires_at we already reminded about (no repeats)
--
-- Everything that writes a plan goes through activate_sevigo_plan() (payments,
-- admin grants) or the hourly maintain_sevigo_plans(). A signed-in user can
-- still only downgrade themselves to 'payg'; they can't set a plan, an end
-- date or a source. Functions that legitimately write set a transaction-local
-- flag so the protection trigger lets them through (clients can't set it).

alter table sevigo_subscriptions add column if not exists plan_expires_at timestamptz;
alter table sevigo_subscriptions add column if not exists plan_source text not null default 'paid';
alter table sevigo_subscriptions add column if not exists reminded_for timestamptz;
do $$ begin
  alter table sevigo_subscriptions add constraint sevigo_subscriptions_plan_source_check check (plan_source in ('paid', 'granted'));
exception when duplicate_object then null; end $$;

-- ---- audit trail of admin grants / revokes ----
create table if not exists sevigo_plan_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null,
  days int,                                  -- NULL = no end date
  kind text not null check (kind in ('grant', 'revoke')),
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);
alter table sevigo_plan_grants enable row level security;
drop policy if exists "admin reads plan grants" on sevigo_plan_grants;
create policy "admin reads plan grants" on sevigo_plan_grants for select using (is_admin());

-- Admins need to see a user's plan on the user screen.
drop policy if exists "admin reads subscriptions" on sevigo_subscriptions;
create policy "admin reads subscriptions" on sevigo_subscriptions for select using (is_admin());

-- ---- protection: users may only downgrade to payg ----
create or replace function protect_sevigo_subscription() returns trigger
language plpgsql as $$
begin
  if auth.role() = 'authenticated'
     and pg_trigger_depth() = 1
     and coalesce(current_setting('sevigo.plan_writer', true), '') <> '1' then
    if tg_op = 'INSERT' then
      new.plan_id := 'payg';
      new.invoices_this_cycle := 0;
      new.plan_expires_at := null;
      new.plan_source := 'paid';
      new.reminded_for := null;
    else
      if new.plan_id is distinct from old.plan_id and new.plan_id <> 'payg' then
        new.plan_id := old.plan_id;
      end if;
      if new.plan_id = 'payg' then
        new.plan_expires_at := null;
        new.plan_source := 'paid';
      else
        new.plan_expires_at := old.plan_expires_at;
        new.plan_source := old.plan_source;
      end if;
      new.reminded_for := old.reminded_for;
      new.invoices_this_cycle := old.invoices_this_cycle;
      new.cycle_start := old.cycle_start;
    end if;
  end if;
  return new;
end; $$;

-- ---- activate / extend a plan (the single write path) ----
-- Same plan still running -> extend from its current end (renewing early
-- never wastes days). Different plan -> starts now. A plan with no end date
-- keeps having none. Resets the monthly invoice counter.
create or replace function activate_sevigo_plan(
  p_user_id uuid, p_plan_id text, p_days int default 30, p_source text default 'paid'
) returns timestamptz
language plpgsql security definer as $$
declare
  v_cur sevigo_subscriptions%rowtype;
  v_had boolean;
  v_exp timestamptz;
begin
  if p_plan_id not in ('starter', 'growth', 'unlimited') then raise exception 'Formule invalide.'; end if;
  if p_source not in ('paid', 'granted') then raise exception 'Source invalide.'; end if;
  perform set_config('sevigo.plan_writer', '1', true);

  select * into v_cur from sevigo_subscriptions where user_id = p_user_id for update;
  v_had := found;

  if p_days is null then
    v_exp := null;
  elsif v_had and v_cur.plan_id = p_plan_id and v_cur.plan_expires_at is null then
    v_exp := null;                                           -- already has no end date: never shorten it
  elsif v_had and v_cur.plan_id = p_plan_id and v_cur.plan_expires_at > now() then
    v_exp := v_cur.plan_expires_at + make_interval(days => p_days);
  else
    v_exp := now() + make_interval(days => p_days);
  end if;

  insert into sevigo_subscriptions (user_id, plan_id, plan_expires_at, plan_source, invoices_this_cycle, cycle_start, reminded_for)
  values (p_user_id, p_plan_id, v_exp, case when v_exp is null then 'granted' else p_source end, 0, date_trunc('month', now()), null)
  on conflict (user_id) do update set
    plan_id = excluded.plan_id,
    plan_expires_at = excluded.plan_expires_at,
    plan_source = case when excluded.plan_expires_at is null then 'granted' else excluded.plan_source end,
    invoices_this_cycle = 0,
    cycle_start = excluded.cycle_start,
    reminded_for = null,
    updated_at = now();
  perform set_config('sevigo.plan_writer', '', true);
  return v_exp;
end; $$;
revoke all on function activate_sevigo_plan(uuid, text, int, text) from public, anon, authenticated;

-- ---- admin: grant a free plan / trial of a chosen length ----
create or replace function admin_grant_sevigo_plan(p_user_id uuid, p_plan_id text, p_days int) returns timestamptz
language plpgsql security definer as $$
declare v_exp timestamptz; v_label text := initcap(p_plan_id);
begin
  if not is_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  if p_days is not null and (p_days < 1 or p_days > 3650) then raise exception 'Durée invalide (1 à 3650 jours).'; end if;
  if not exists (select 1 from profiles where id = p_user_id) then raise exception 'Utilisateur introuvable.'; end if;

  v_exp := activate_sevigo_plan(p_user_id, p_plan_id, p_days, 'granted');
  insert into sevigo_plan_grants (user_id, plan_id, days, kind, granted_by) values (p_user_id, p_plan_id, p_days, 'grant', auth.uid());
  insert into notifications (user_id, type, title, body, action_route)
  values (p_user_id, 'system', 'Sèvi Go offert',
    case when v_exp is null
      then 'Votre formule Sèvi Go ' || v_label || ' est offerte, sans date de fin.'
      else 'Votre formule Sèvi Go ' || v_label || ' est offerte jusqu''au ' || to_char(v_exp, 'DD/MM/YYYY') || '.' end,
    '/sevigo/dashboard');
  return v_exp;
end; $$;
revoke all on function admin_grant_sevigo_plan(uuid, text, int) from public, anon;
grant execute on function admin_grant_sevigo_plan(uuid, text, int) to authenticated;

create or replace function admin_revoke_sevigo_plan(p_user_id uuid) returns void
language plpgsql security definer as $$
declare v_plan text;
begin
  if not is_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  perform set_config('sevigo.plan_writer', '1', true);
  select plan_id into v_plan from sevigo_subscriptions where user_id = p_user_id;
  if v_plan is null or v_plan = 'payg' then return; end if;
  update sevigo_subscriptions set plan_id = 'payg', plan_expires_at = null, plan_source = 'paid', reminded_for = null, updated_at = now()
    where user_id = p_user_id;
  perform set_config('sevigo.plan_writer', '', true);
  insert into sevigo_plan_grants (user_id, plan_id, days, kind, granted_by) values (p_user_id, v_plan, null, 'revoke', auth.uid());
end; $$;
revoke all on function admin_revoke_sevigo_plan(uuid) from public, anon;
grant execute on function admin_revoke_sevigo_plan(uuid) to authenticated;

-- ---- hourly: reminders (3 days before), expiry -> payg, monthly counter reset ----
create or replace function maintain_sevigo_plans() returns void
language plpgsql security definer as $$
declare r record;
begin
  perform set_config('sevigo.plan_writer', '1', true);

  for r in
    select user_id, plan_id, plan_expires_at from sevigo_subscriptions
    where plan_id <> 'payg' and plan_expires_at is not null
      and plan_expires_at > now() and plan_expires_at <= now() + interval '3 days'
      and reminded_for is distinct from plan_expires_at
  loop
    insert into notifications (user_id, type, title, body, action_route)
    values (r.user_id, 'system', 'Votre formule Sèvi Go expire bientôt',
      'Votre formule ' || initcap(r.plan_id) || ' se termine le ' || to_char(r.plan_expires_at, 'DD/MM/YYYY')
        || '. Renouvelez-la pour garder vos avantages.', '/sevigo/plan');
    update sevigo_subscriptions set reminded_for = r.plan_expires_at where user_id = r.user_id;
  end loop;

  for r in
    select user_id, plan_id from sevigo_subscriptions
    where plan_id <> 'payg' and plan_expires_at is not null and plan_expires_at <= now()
  loop
    update sevigo_subscriptions
      set plan_id = 'payg', plan_expires_at = null, plan_source = 'paid', reminded_for = null, updated_at = now()
      where user_id = r.user_id;
    insert into notifications (user_id, type, title, body, action_route)
    values (r.user_id, 'system', 'Votre formule Sèvi Go a pris fin',
      'Votre formule ' || initcap(r.plan_id) || ' est terminée : vous êtes repassé en Pay As You Go. Vous pouvez la renouveler à tout moment.',
      '/sevigo/plan');
  end loop;

  update sevigo_subscriptions set invoices_this_cycle = 0, cycle_start = date_trunc('month', now())
    where cycle_start < date_trunc('month', now());
  perform set_config('sevigo.plan_writer', '', true);
end; $$;
revoke all on function maintain_sevigo_plans() from public, anon, authenticated;

do $$ begin
  perform cron.unschedule('sevigo-plan-maintenance') from cron.job where jobname = 'sevigo-plan-maintenance';
  perform cron.schedule('sevigo-plan-maintenance', '0 * * * *', 'select maintain_sevigo_plans()');
end $$;

-- ---- one-time backfill of plans that predate the lifecycle ----
-- Paid before: period = last confirmed payment + 30 days. On a paid plan with
-- no payment on record (given for free by hand): no end date.
update sevigo_subscriptions s
  set plan_expires_at = p.last_paid + interval '30 days', plan_source = 'paid'
  from (select user_id, max(confirmed_at) as last_paid from sevigo_plan_payments where status = 'completed' group by user_id) p
  where s.user_id = p.user_id and s.plan_id <> 'payg' and s.plan_expires_at is null and s.plan_source = 'paid';
update sevigo_subscriptions s
  set plan_source = 'granted'
  where s.plan_id <> 'payg' and s.plan_expires_at is null and s.plan_source = 'paid'
    and not exists (select 1 from sevigo_plan_payments p where p.user_id = s.user_id and p.status = 'completed');
