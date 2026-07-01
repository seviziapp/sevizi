-- Sèvizi — Provider profile: gallery photos + avatar
-- Run in Supabase → SQL Editor (idempotent).

alter table providers add column if not exists gallery    text[] default '{}';
alter table providers add column if not exists avatar_url text;
