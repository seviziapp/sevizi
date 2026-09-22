-- Sèvizi — rate-limit request creation to block spam/bot accounts
-- Run in Supabase → SQL Editor (idempotent).
--
-- Prompted by a bot account (crawlerrobo@gmail.com, display name "khkcsi
-- gdxsol") that posted 27 fake "urgent" requests between July and
-- September, in bursts of several within the same minute. Two limits catch
-- both the burst pattern and sustained lower-and-slower spam, while staying
-- generous enough that no real client should ever hit them:
--   - burst:  max 3 requests in any rolling 10-minute window
--   - daily:  max 8 requests in any rolling 24-hour window
--
-- Admins can't create requests at all (see block_admin_as_client in
-- migration_admin_hierarchy.sql), so this only ever applies to real
-- client accounts.

create or replace function enforce_request_rate_limit() returns trigger
language plpgsql as $$
declare
  v_recent_count int;
  v_daily_count int;
begin
  if new.client_id is null then
    return new;
  end if;

  select count(*) into v_recent_count
  from requests
  where client_id = new.client_id
    and created_at > now() - interval '10 minutes';
  if v_recent_count >= 3 then
    raise exception 'Trop de demandes créées en peu de temps. Patientez quelques minutes avant de réessayer.';
  end if;

  select count(*) into v_daily_count
  from requests
  where client_id = new.client_id
    and created_at > now() - interval '24 hours';
  if v_daily_count >= 8 then
    raise exception 'Limite quotidienne de demandes atteinte. Réessayez demain.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_request_rate_limit on requests;
create trigger trg_enforce_request_rate_limit before insert on requests
  for each row execute function enforce_request_rate_limit();
