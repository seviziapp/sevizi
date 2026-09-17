-- Sèvizi — notify both sides when admin closes a stale open request.
-- Run in Supabase → SQL Editor. Idempotent.
--
-- Fires only when the actor isn't the client themselves (a client cancelling
-- their own request already knows about it) — in practice that means admin,
-- since only "own requests" (client) and "admin manages requests" (admin)
-- can update a request per RLS.
create or replace function notify_request_closed_by_admin() returns trigger
language plpgsql security definer as $$
declare v_offer record;
begin
  if new.status in ('annulee','terminee') and old.status = 'ouverte'
     and auth.uid() is distinct from new.client_id then
    if new.client_id is not null then
      insert into notifications (user_id, type, title, body, action_route)
      values (
        new.client_id, 'system',
        case when new.status = 'annulee' then 'Demande annulée' else 'Demande clôturée' end,
        'Votre demande a été ' || (case when new.status = 'annulee' then 'annulée' else 'clôturée' end) ||
          ' par notre équipe après vérification.',
        '/client/requests'
      );
    end if;
    for v_offer in
      select distinct p.user_id from offers o
      join providers p on p.id = o.provider_id
      where o.request_id = new.id and p.user_id is not null
    loop
      insert into notifications (user_id, type, title, body, action_route)
      values (
        v_offer.user_id, 'system', 'Demande clôturée',
        'Une demande à laquelle vous aviez répondu a été clôturée par notre équipe.',
        '/provider/requests'
      );
    end loop;
  end if;
  return new;
end; $$;

drop trigger if exists trg_notify_request_closed_by_admin on requests;
create trigger trg_notify_request_closed_by_admin after update on requests
  for each row execute function notify_request_closed_by_admin();
