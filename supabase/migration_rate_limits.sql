-- Sèvizi — rate limits on everything a user can spam
-- Run in Supabase → SQL Editor (idempotent).
--
-- migration_request_rate_limit.sql already covers request creation (a bot
-- posted 27 fake requests). Same approach for the other write paths an
-- automated account could flood. Thresholds sit well above real usage
-- (observed peaks: 2 messages/minute, 6 offers/hour) so they only ever bite
-- scripts. Enforced in the database, so they apply to the web app, the
-- Android app and direct API calls alike.
--
--   offers                 8 / 5 min,   40 / 24 h   per provider
--   messages              20 / 1 min,  300 / 1 h    per sender
--   appointments           5 / 1 h,     15 / 24 h   per client
--   disputes               5 / 24 h                 per reporter
--   verification_requests  3 / 24 h                 per user

create or replace function assert_under_rate_limit(
  p_table text, p_col text, p_id uuid, p_window interval, p_max int, p_message text
) returns void
language plpgsql as $$
declare v_count int;
begin
  if p_id is null then return; end if;
  execute format('select count(*) from %I where %I = $1 and created_at > now() - $2', p_table, p_col)
    into v_count using p_id, p_window;
  if v_count >= p_max then
    raise exception '%', p_message using errcode = 'P0001';
  end if;
end;
$$;

create or replace function rl_offers() returns trigger language plpgsql as $$
begin
  perform assert_under_rate_limit('offers', 'provider_id', new.provider_id, interval '5 minutes', 8,
    'Trop d''offres envoyées en peu de temps. Patientez quelques minutes.');
  perform assert_under_rate_limit('offers', 'provider_id', new.provider_id, interval '24 hours', 40,
    'Limite quotidienne d''offres atteinte. Réessayez demain.');
  return new;
end; $$;
drop trigger if exists trg_rl_offers on offers;
create trigger trg_rl_offers before insert on offers for each row execute function rl_offers();

create or replace function rl_messages() returns trigger language plpgsql as $$
begin
  perform assert_under_rate_limit('messages', 'sender_id', new.sender_id, interval '1 minute', 20,
    'Vous envoyez trop de messages. Patientez un instant.');
  perform assert_under_rate_limit('messages', 'sender_id', new.sender_id, interval '1 hour', 300,
    'Limite horaire de messages atteinte. Réessayez plus tard.');
  return new;
end; $$;
drop trigger if exists trg_rl_messages on messages;
create trigger trg_rl_messages before insert on messages for each row execute function rl_messages();

create or replace function rl_appointments() returns trigger language plpgsql as $$
begin
  perform assert_under_rate_limit('appointments', 'client_id', new.client_id, interval '1 hour', 5,
    'Trop de réservations en peu de temps. Réessayez plus tard.');
  perform assert_under_rate_limit('appointments', 'client_id', new.client_id, interval '24 hours', 15,
    'Limite quotidienne de réservations atteinte. Réessayez demain.');
  return new;
end; $$;
drop trigger if exists trg_rl_appointments on appointments;
create trigger trg_rl_appointments before insert on appointments for each row execute function rl_appointments();

create or replace function rl_disputes() returns trigger language plpgsql as $$
begin
  perform assert_under_rate_limit('disputes', 'reporter_id', new.reporter_id, interval '24 hours', 5,
    'Limite quotidienne de signalements atteinte.');
  return new;
end; $$;
drop trigger if exists trg_rl_disputes on disputes;
create trigger trg_rl_disputes before insert on disputes for each row execute function rl_disputes();

create or replace function rl_verification_requests() returns trigger language plpgsql as $$
begin
  perform assert_under_rate_limit('verification_requests', 'user_id', new.user_id, interval '24 hours', 3,
    'Trop de demandes de vérification aujourd''hui. Réessayez demain.');
  return new;
end; $$;
drop trigger if exists trg_rl_verification_requests on verification_requests;
create trigger trg_rl_verification_requests before insert on verification_requests for each row execute function rl_verification_requests();
