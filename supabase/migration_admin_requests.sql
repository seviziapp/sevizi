-- Sèvizi — lets admin close/cancel a stale "ouverte" request after following
-- up by phone with the client (or the providers who never offered), instead
-- of it sitting open indefinitely. Run in Supabase → SQL Editor. Idempotent.
--
-- `requests` already has "requests readable" (select using (true)), so admin
-- can already see every open request — this only adds the missing UPDATE
-- grant so admin can actually change status, admin-only, without touching
-- the existing "own requests" policy client's use to manage their own.
drop policy if exists "admin manages requests" on requests;
create policy "admin manages requests" on requests for update using (is_admin());
