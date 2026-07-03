-- Sèvizi — Real coordinates for "nearby" matching (run in Supabase → SQL Editor; idempotent)
--
-- Plain lat/lng columns (simpler to read back than parsing the PostGIS
-- geography column client-side) so the app can center maps and "nearby"
-- queries on the user's actual saved location instead of a fixed city point.

alter table profiles add column if not exists location_lat double precision;
alter table profiles add column if not exists location_lng double precision;
