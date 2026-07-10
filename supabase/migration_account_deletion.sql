-- Sèvizi — Self-service account deletion
-- Run in Supabase → SQL Editor (idempotent).
--
-- Deleting a user from auth.users cascades through almost every table via
-- existing "on delete cascade" foreign keys. Left as-is, that's dangerous:
-- e.g. if a CLIENT deletes their account, `jobs.client_id`'s cascade would
-- delete the job row, which would cascade-delete `job_payments` too —
-- silently erasing the PROVIDER's earnings record for a completed,
-- already-paid job. Same risk in reverse if a provider deletes their
-- account. Financial/ledger integrity for the *other* party must survive
-- either party leaving.
--
-- Fix: change the foreign keys along that chain (requests -> offers ->
-- jobs -> job_payments/pro_payments/withdrawal_requests, plus reviews and
-- disputes) from CASCADE to SET NULL, so those rows survive with the
-- departed user's identity nulled out instead of disappearing. Everything
-- else (profile, provider listing, messages, favorites, notifications,
-- verification docs) still fully cascades away — that's genuinely personal
-- data with no reason to keep it.

alter table requests drop constraint if exists requests_client_id_fkey;
alter table requests alter column client_id drop not null;
alter table requests add constraint requests_client_id_fkey
  foreign key (client_id) references auth.users(id) on delete set null;

alter table offers drop constraint if exists offers_provider_id_fkey;
alter table offers alter column provider_id drop not null;
alter table offers add constraint offers_provider_id_fkey
  foreign key (provider_id) references providers(id) on delete set null;

alter table jobs drop constraint if exists jobs_request_id_fkey;
alter table jobs alter column request_id drop not null;
alter table jobs add constraint jobs_request_id_fkey
  foreign key (request_id) references requests(id) on delete set null;

alter table jobs drop constraint if exists jobs_offer_id_fkey;
alter table jobs alter column offer_id drop not null;
alter table jobs add constraint jobs_offer_id_fkey
  foreign key (offer_id) references offers(id) on delete set null;

alter table jobs drop constraint if exists jobs_provider_id_fkey;
alter table jobs alter column provider_id drop not null;
alter table jobs add constraint jobs_provider_id_fkey
  foreign key (provider_id) references providers(id) on delete set null;

alter table jobs drop constraint if exists jobs_client_id_fkey;
alter table jobs alter column client_id drop not null;
alter table jobs add constraint jobs_client_id_fkey
  foreign key (client_id) references auth.users(id) on delete set null;

alter table job_payments drop constraint if exists job_payments_client_id_fkey;
alter table job_payments alter column client_id drop not null;
alter table job_payments add constraint job_payments_client_id_fkey
  foreign key (client_id) references auth.users(id) on delete set null;

alter table job_payments drop constraint if exists job_payments_provider_id_fkey;
alter table job_payments alter column provider_id drop not null;
alter table job_payments add constraint job_payments_provider_id_fkey
  foreign key (provider_id) references providers(id) on delete set null;

alter table pro_payments drop constraint if exists pro_payments_provider_id_fkey;
alter table pro_payments alter column provider_id drop not null;
alter table pro_payments add constraint pro_payments_provider_id_fkey
  foreign key (provider_id) references providers(id) on delete set null;

alter table pro_payments drop constraint if exists pro_payments_user_id_fkey;
alter table pro_payments alter column user_id drop not null;
alter table pro_payments add constraint pro_payments_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

alter table withdrawal_requests drop constraint if exists withdrawal_requests_provider_id_fkey;
alter table withdrawal_requests alter column provider_id drop not null;
alter table withdrawal_requests add constraint withdrawal_requests_provider_id_fkey
  foreign key (provider_id) references providers(id) on delete set null;

alter table withdrawal_requests drop constraint if exists withdrawal_requests_user_id_fkey;
alter table withdrawal_requests alter column user_id drop not null;
alter table withdrawal_requests add constraint withdrawal_requests_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

-- Reviews affect a provider's public rating average — deleting the
-- reviewer's account shouldn't silently change other providers' ratings.
-- author_name is already a denormalized text field, so the review stays
-- displayable with author_id nulled out.
alter table reviews drop constraint if exists reviews_author_id_fkey;
alter table reviews alter column author_id drop not null;
alter table reviews add constraint reviews_author_id_fkey
  foreign key (author_id) references auth.users(id) on delete set null;

-- Disputes are a record admins may need for a long time after the fact.
-- reporter_name is already denormalized.
alter table disputes drop constraint if exists disputes_reporter_id_fkey;
alter table disputes alter column reporter_id drop not null;
alter table disputes add constraint disputes_reporter_id_fkey
  foreign key (reporter_id) references auth.users(id) on delete set null;
