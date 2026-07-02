-- Sèvizi — Admin role (run in Supabase → SQL Editor; idempotent)
--
-- Admins are designated here in the database. The app grants access to the
-- back-office (/admin) only to profiles where is_admin = true, and hides the
-- admin entry point from everyone else.

alter table profiles add column if not exists is_admin boolean default false;

-- Make yourself an admin (replace with your email):
--   update profiles set is_admin = true where email = 'weareaurumgroup@gmail.com';
