-- Sèvizi — Offer acceptance + automatic cross-user notifications
-- Run in Supabase → SQL Editor (idempotent; safe to re-run).
--
-- Why triggers: the notifications RLS policy only lets a user touch rows where
-- user_id = auth.uid(). So a provider can't insert a "you got an offer" row for
-- the client, and a client can't insert an "offer accepted" row for the provider.
-- These SECURITY DEFINER triggers run with elevated rights and create the right
-- notification for the right recipient automatically.

-- ------------------------------------------------------------------
-- 0. Denormalize the client's name/phone onto the job.
--    profiles RLS only lets a user read their OWN profile, so a provider
--    cannot look up the client's contact details. The client (who is allowed
--    to read their own profile) writes them onto the job when accepting.
-- ------------------------------------------------------------------
alter table jobs add column if not exists client_name  text;
alter table jobs add column if not exists client_phone text;

-- ------------------------------------------------------------------
-- 1. Let the request's client accept (update) offers on their request
-- ------------------------------------------------------------------
drop policy if exists "client accepts offer" on offers;
create policy "client accepts offer" on offers for update
  using (exists (select 1 from requests r where r.id = offers.request_id and r.client_id = auth.uid()));

-- ------------------------------------------------------------------
-- 2. New offer  ->  notify the client who posted the request
-- ------------------------------------------------------------------
create or replace function notify_new_offer() returns trigger
language plpgsql security definer as $$
declare v_client uuid; v_name text;
begin
  select r.client_id into v_client from requests r where r.id = new.request_id;
  select p.name into v_name from providers p where p.id = new.provider_id;
  if v_client is not null then
    insert into notifications (user_id, type, title, body, action_route)
    values (v_client, 'offer', 'Nouvelle offre reçue',
            coalesce(v_name, 'Un prestataire') || ' a répondu à votre demande — '
              || coalesce(new.price::text, '?') || ' F.',
            '/client/offers?requestId=' || new.request_id::text);
  end if;
  return new;
end; $$;
drop trigger if exists trg_notify_new_offer on offers;
create trigger trg_notify_new_offer after insert on offers
  for each row execute function notify_new_offer();

-- ------------------------------------------------------------------
-- 3. Offer accepted (job created)  ->  notify the provider
-- ------------------------------------------------------------------
create or replace function notify_job_created() returns trigger
language plpgsql security definer as $$
declare v_user uuid; v_client_name text;
begin
  select user_id into v_user from providers where id = new.provider_id;
  select full_name into v_client_name from profiles where id = new.client_id;
  if v_user is not null then
    insert into notifications (user_id, type, title, body, action_route)
    values (v_user, 'accepted', 'Offre acceptée 🎉',
            coalesce(v_client_name, 'Un client') || ' a accepté votre offre. Démarrez la mission.',
            '/provider/active-job');
  end if;
  return new;
end; $$;
drop trigger if exists trg_notify_job_created on jobs;
create trigger trg_notify_job_created after insert on jobs
  for each row execute function notify_job_created();

-- ------------------------------------------------------------------
-- 4. Job status change  ->  notify the client
-- ------------------------------------------------------------------
create or replace function notify_job_status() returns trigger
language plpgsql security definer as $$
declare v_label text;
begin
  if new.status = old.status then return new; end if;
  v_label := case new.status
    when 'en_route' then 'Votre prestataire est en route 🚗'
    when 'arrive'   then 'Votre prestataire est arrivé 📍'
    when 'en_cours' then 'La mission a commencé 🔧'
    when 'termine'  then 'Mission terminée 🏁 — laissez un avis !'
    else 'Mise à jour de votre mission' end;
  insert into notifications (user_id, type, title, body, action_route)
  values (new.client_id,
          (case new.status when 'arrive' then 'arrived' when 'termine' then 'completed' else 'accepted' end)::notif_type,
          v_label, '', '/client/job-status');
  return new;
end; $$;
drop trigger if exists trg_notify_job_status on jobs;
create trigger trg_notify_job_status after update on jobs
  for each row execute function notify_job_status();

-- ------------------------------------------------------------------
-- 5. New message  ->  notify the other party in the thread
-- ------------------------------------------------------------------
create or replace function notify_new_message() returns trigger
language plpgsql security definer as $$
declare v_client uuid; v_recipient uuid; v_name text;
begin
  select r.client_id into v_client from requests r where r.id = new.request_id;
  if new.sender_id = v_client then
    -- client -> provider: prefer the job's provider, else the latest offer's provider
    select pr.user_id into v_recipient
      from jobs j join providers pr on pr.id = j.provider_id
      where j.request_id = new.request_id order by j.accepted_at desc limit 1;
    if v_recipient is null then
      select pr.user_id into v_recipient
        from offers o join providers pr on pr.id = o.provider_id
        where o.request_id = new.request_id order by o.created_at desc limit 1;
    end if;
  else
    v_recipient := v_client;
  end if;
  if v_recipient is not null and v_recipient <> new.sender_id then
    select coalesce(full_name, 'Quelqu''un') into v_name from profiles where id = new.sender_id;
    insert into notifications (user_id, type, title, body, action_route)
    values (v_recipient, 'system', 'Nouveau message',
            coalesce(v_name, 'Quelqu''un') || ' vous a envoyé un message.',
            '/client/thread?requestId=' || new.request_id::text);
  end if;
  return new;
end; $$;
drop trigger if exists trg_notify_new_message on messages;
create trigger trg_notify_new_message after insert on messages
  for each row execute function notify_new_message();
