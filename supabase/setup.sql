-- ============================================================================
-- Sèvizi — ONE-SHOT SETUP
-- Paste this whole file into Supabase → SQL Editor → Run.
-- It is idempotent: safe to run any number of times. Run it after schema.sql.
-- It brings the database fully in sync with the deployed app (all features).
-- ============================================================================


-- ============================================================
-- 1) Signup detail fields + verification (client & provider)
-- ============================================================
alter table profiles add column if not exists first_name text;
alter table profiles add column if not exists last_name  text;
alter table profiles add column if not exists email      text;
alter table profiles add column if not exists verified   boolean default false;
alter table profiles add column if not exists id_doc_url text;
alter table profiles add column if not exists onboarded  boolean default false;

alter table verification_requests alter column provider_id drop not null;
alter table verification_requests add column if not exists user_id      uuid references auth.users(id) on delete cascade;
alter table verification_requests add column if not exists type         text not null default 'provider' check (type in ('client','provider'));
alter table verification_requests add column if not exists display_name text;
alter table verification_requests add column if not exists company_info text;

drop policy if exists "submit own verification" on verification_requests;
create policy "submit own verification" on verification_requests
  for insert with check (auth.uid() = user_id);
drop policy if exists "read verifications" on verification_requests;
create policy "read verifications" on verification_requests for select using (true);
drop policy if exists "update verifications" on verification_requests;
create policy "update verifications" on verification_requests for update using (true);

insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do nothing;

drop policy if exists "upload documents" on storage.objects;
create policy "upload documents" on storage.objects
  for insert to authenticated with check (bucket_id = 'documents');
drop policy if exists "read documents" on storage.objects;
create policy "read documents" on storage.objects
  for select using (bucket_id = 'documents');


-- ============================================================
-- 2) Provider profile: gallery photos + avatar
-- ============================================================
alter table providers add column if not exists gallery    text[] default '{}';
alter table providers add column if not exists avatar_url text;


-- ============================================================
-- 3) Offer acceptance + denormalized client contact on jobs
-- ============================================================
alter table jobs add column if not exists client_name  text;
alter table jobs add column if not exists client_phone text;

drop policy if exists "client accepts offer" on offers;
create policy "client accepts offer" on offers for update
  using (exists (select 1 from requests r where r.id = offers.request_id and r.client_id = auth.uid()));


-- ============================================================
-- 4) Automatic notifications (SECURITY DEFINER triggers)
-- ============================================================
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
          case new.status when 'arrive' then 'arrived' when 'termine' then 'completed' else 'accepted' end,
          v_label, '', '/client/job-status');
  return new;
end; $$;
drop trigger if exists trg_notify_job_status on jobs;
create trigger trg_notify_job_status after update on jobs
  for each row execute function notify_job_status();

create or replace function notify_new_message() returns trigger
language plpgsql security definer as $$
declare v_client uuid; v_recipient uuid; v_name text;
begin
  select r.client_id into v_client from requests r where r.id = new.request_id;
  if new.sender_id = v_client then
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


-- ============================================================
-- 5) Reviews: recompute provider rating + notify + one per job
-- ============================================================
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'reviews_job_unique') then
    alter table reviews add constraint reviews_job_unique unique (job_id);
  end if;
end $$;

create or replace function on_new_review() returns trigger
language plpgsql security definer as $$
declare v_avg numeric; v_count int; v_user uuid;
begin
  select round(avg(rating)::numeric, 1), count(*) into v_avg, v_count
    from reviews where provider_id = new.provider_id;
  update providers set rating = coalesce(v_avg, 0), reviews = coalesce(v_count, 0)
    where id = new.provider_id;
  select user_id into v_user from providers where id = new.provider_id;
  if v_user is not null then
    insert into notifications (user_id, type, title, body, action_route)
    values (v_user, 'review', 'Nouvel avis ⭐',
            coalesce(new.author_name, 'Un client') || ' vous a laissé ' || new.rating || '/5.',
            '/provider/profile');
  end if;
  return new;
end; $$;
drop trigger if exists trg_on_new_review on reviews;
create trigger trg_on_new_review after insert on reviews
  for each row execute function on_new_review();


-- ============================================================
-- 6) Messaging: precise thread access (no cross-account leaks)
-- ============================================================
drop policy if exists "msgs in own thread" on messages;
drop policy if exists "thread parties"    on messages;
create policy "thread parties" on messages for all using (
  sender_id = auth.uid()
  or exists (select 1 from requests r where r.id = messages.request_id and r.client_id = auth.uid())
  or exists (
    select 1 from jobs j join providers p on p.id = j.provider_id
    where j.request_id = messages.request_id and p.user_id = auth.uid()
  )
) with check (sender_id = auth.uid());

-- Done ✅
