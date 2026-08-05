-- Sèvizi — Shareable booking link for Sèvizi Pro providers
-- Run in Supabase → SQL Editor (idempotent).
--
-- A Pro provider gets a public link like sevizi.app/b/<username> to share
-- with clients directly. Defaults to a slugified version of their business
-- name (computed client-side), editable afterward if the new value is free.
-- No tier check at the DB level — enforced in the app (any tier CAN have a
-- username stored, but the share-link UI itself only appears for Pro) since
-- there's no harm in the column existing on a free row, and it keeps this
-- migration simple.

alter table providers add column if not exists username text unique;

do $$ begin
  alter table providers add constraint providers_username_format
    check (username is null or username ~ '^[a-z0-9-]{3,30}$');
exception when duplicate_object then null;
end $$;
