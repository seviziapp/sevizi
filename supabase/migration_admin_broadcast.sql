-- Sèvizi — Admin broadcast notifications
-- Run in Supabase → SQL Editor (idempotent).
--
-- Lets any admin push a one-off notification to every client, every
-- provider, or everyone at once — delivered through the existing
-- notifications table/screen, no new delivery channel needed. Admin
-- accounts themselves are always excluded (they're not real
-- client/provider users — see migration_admin_hierarchy.sql — and have no
-- reason to receive a broadcast meant for the marketplace).
--
-- SECURITY DEFINER so it can insert one row per recipient regardless of the
-- caller's own RLS, but it checks is_admin() itself first, so only an admin
-- can actually invoke it — safe to grant broadly like the other admin RPCs.

create or replace function admin_broadcast_notification(
  p_audience text, p_title text, p_body text, p_action_route text default null
) returns int
language plpgsql security definer as $$
declare v_count int;
begin
  if not is_admin() then
    raise exception 'Réservé aux administrateurs.';
  end if;
  if p_audience not in ('client', 'prestataire', 'all') then
    raise exception 'Audience invalide.';
  end if;
  if coalesce(trim(p_title), '') = '' or coalesce(trim(p_body), '') = '' then
    raise exception 'Titre et message requis.';
  end if;

  insert into notifications (user_id, type, title, body, action_route)
  select id, 'system', p_title, p_body, p_action_route
  from profiles
  where not is_admin
    and (p_audience = 'all' or role = p_audience::user_role);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
