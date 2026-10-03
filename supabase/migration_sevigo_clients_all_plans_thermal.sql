-- Sèvi Go — saved clients for every plan + per-account USB thermal printing
-- Run in Supabase → SQL Editor (idempotent). Needs
-- migration_sevigo_clients_reports.sql.
--
-- 1) Clients: every Sèvi Go user can pick a saved client on an invoice or
--    create a new one. (Writing used to need the Unlimited plan; the till,
--    stock and sales stay Unlimited-only.) Capped per account so the list
--    can't be used to dump unbounded rows.
--
-- 2) profiles.thermal_printer: direct USB thermal printing is a per-account
--    switch, off for everyone by default. Only an admin (via
--    admin_set_thermal_printer) or the service role can change it — a user
--    can't turn it on for themselves (reset by protect_profile_verified).

drop policy if exists "own clients insert" on sevigo_clients;
create policy "own clients insert" on sevigo_clients for insert with check (auth.uid() = user_id);
drop policy if exists "own clients update" on sevigo_clients;
create policy "own clients update" on sevigo_clients for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own clients delete" on sevigo_clients;
create policy "own clients delete" on sevigo_clients for delete using (auth.uid() = user_id);

create or replace function cap_sevigo_clients() returns trigger
language plpgsql as $$
begin
  if (select count(*) from sevigo_clients where user_id = new.user_id) >= 2000 then
    raise exception 'Limite de 2000 clients enregistrés atteinte.';
  end if;
  return new;
end; $$;
drop trigger if exists trg_cap_sevigo_clients on sevigo_clients;
create trigger trg_cap_sevigo_clients before insert on sevigo_clients
  for each row execute function cap_sevigo_clients();

alter table profiles add column if not exists thermal_printer boolean not null default false;

create or replace function protect_profile_verified() returns trigger
language plpgsql as $$
begin
  if auth.role() = 'authenticated' and not is_admin() then
    if tg_op = 'INSERT' then
      new.verified := false;
      new.is_test := false;
      new.thermal_printer := false;
    else
      new.verified := old.verified;
      new.is_test := old.is_test;
      new.thermal_printer := old.thermal_printer;
    end if;
  end if;
  return new;
end; $$;

create or replace function admin_set_thermal_printer(p_user_id uuid, p_enabled boolean) returns void
language plpgsql security definer as $$
begin
  if not is_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  update profiles set thermal_printer = p_enabled where id = p_user_id;
end; $$;
revoke all on function admin_set_thermal_printer(uuid, boolean) from public, anon;
grant execute on function admin_set_thermal_printer(uuid, boolean) to authenticated;
