-- Sèvizi — Keep client/provider contact info off the platform
-- Run in Supabase → SQL Editor (idempotent).
--
-- Two layers:
-- 1) Postgres-level column lock on jobs.client_phone — even a hand-crafted
--    REST request against the table (bypassing the app entirely) cannot read
--    this column as an authenticated user. The app itself never queries it in
--    its own select() calls, but this is real DB enforcement, not just UI
--    hiding. Our own SQL-editor / service-role access is unaffected (support
--    can still look up a phone number directly if a dispute genuinely needs
--    it) — only the app-facing `authenticated` role is blocked.
revoke select (client_phone) on jobs from authenticated;

-- 2) Best-effort server-side redaction of phone numbers / emails typed into
--    messages, as a backstop in case the client-side check (contentSafety.ts)
--    is bypassed. Mirrors that check's logic: 7+ digits in a tight run, or an
--    email address.
create or replace function redact_contact_info() returns trigger
language plpgsql as $$
begin
  if new.body is null then return new; end if;

  new.body := regexp_replace(
    new.body,
    '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
    '[coordonnées masquées]', 'g'
  );

  -- 7 digits, each optionally followed by up to 2 separator characters
  -- (space/dot/dash/parens) — matches real phone numbers while leaving
  -- short incidental numbers (prices, times, counts) untouched.
  new.body := regexp_replace(
    new.body,
    '[0-9][ .()-]{0,2}[0-9][ .()-]{0,2}[0-9][ .()-]{0,2}[0-9][ .()-]{0,2}[0-9][ .()-]{0,2}[0-9][ .()-]{0,2}[0-9]',
    '[coordonnées masquées]', 'g'
  );

  return new;
end; $$;

drop trigger if exists trg_redact_contact_info on messages;
create trigger trg_redact_contact_info before insert on messages
  for each row execute function redact_contact_info();
