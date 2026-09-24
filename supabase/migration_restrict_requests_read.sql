-- Sèvizi — stop exposing every service request to everyone
-- Run in Supabase → SQL Editor (idempotent).
--
-- "requests readable" was `using (true)`: any visitor — even logged out —
-- could read every request's description, address label and exact
-- coordinates. Request text routinely contains personal details (phone
-- numbers, names, home locations).
--
-- Who legitimately needs to read a request row:
--   * its owner (the client)
--   * admins
--   * providers browsing OPEN requests (nearby_requests is SECURITY INVOKER,
--     so it depends on this policy) — any account with a provider listing
--   * a provider who already has an offer or a job on it, even after it
--     closes (their offers/earnings/thread screens embed the request)

drop policy if exists "requests readable" on requests;
drop policy if exists "requests visible to parties" on requests;
create policy "requests visible to parties" on requests for select using (
  auth.uid() = client_id
  or is_admin()
  or (status = 'ouverte' and exists (select 1 from providers p where p.user_id = auth.uid()))
  or exists (
    select 1 from offers o join providers p on p.id = o.provider_id
    where o.request_id = requests.id and p.user_id = auth.uid()
  )
  or exists (
    select 1 from jobs j join providers p on p.id = j.provider_id
    where j.request_id = requests.id and p.user_id = auth.uid()
  )
);
