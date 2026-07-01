-- Sèvizi — Signal a problem during a mission (disputes → admin)
-- Run in Supabase → SQL Editor (idempotent).

-- Denormalized reporter name (the reporter can read their own profile; the
-- admin can't read arbitrary profiles under RLS, so store it on the dispute).
alter table disputes add column if not exists reporter_name text;
alter table disputes add column if not exists reporter_role text; -- 'client' | 'prestataire'

-- RLS: a party can file a dispute for themselves; the admin back-office can
-- read every dispute and resolve them.
drop policy if exists "dispute parties" on disputes;
drop policy if exists "report dispute"  on disputes;
drop policy if exists "read disputes"   on disputes;
drop policy if exists "update disputes" on disputes;
create policy "report dispute" on disputes for insert with check (auth.uid() = reporter_id);
create policy "read disputes"  on disputes for select using (true);
create policy "update disputes" on disputes for update using (true);

-- Notify the OTHER party of the job that a problem was signaled.
create or replace function notify_new_dispute() returns trigger
language plpgsql security definer as $$
declare v_client uuid; v_provider_user uuid; v_recipient uuid;
begin
  select j.client_id, pr.user_id into v_client, v_provider_user
    from jobs j join providers pr on pr.id = j.provider_id
    where j.id = new.job_id;
  v_recipient := case when new.reporter_id = v_client then v_provider_user else v_client end;
  if v_recipient is not null and v_recipient <> new.reporter_id then
    insert into notifications (user_id, type, title, body, action_route)
    values (v_recipient, 'system', 'Problème signalé ⚠️',
            'Un problème a été signalé sur votre mission. Le support va intervenir.',
            '/client/job-status');
  end if;
  return new;
end; $$;
drop trigger if exists trg_notify_new_dispute on disputes;
create trigger trg_notify_new_dispute after insert on disputes
  for each row execute function notify_new_dispute();
