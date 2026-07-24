-- Sèvizi — "Devis sur place" (site visit required before a firm quote)
-- Run in Supabase → SQL Editor (idempotent).
--
-- Some trades (maçon, menuiserie, soudeur, tapissier…) genuinely can't give
-- a firm price from a text description alone. Rather than build a whole
-- separate visit-scheduling system, a provider can mark an offer as
-- visit_required with an estimated price range instead of a firm number.
-- The client can message to arrange the visit (existing thread), and once
-- the provider has actually seen the job, they submit a SECOND, ordinary
-- offer on the same request with a firm price — no new tables needed, this
-- reuses the existing "multiple offers per request" list.

alter table offers add column if not exists visit_required boolean not null default false;
alter table offers add column if not exists price_max int;
