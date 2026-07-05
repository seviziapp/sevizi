-- Sèvizi — Free/Pro provider subscription tier
-- Run in Supabase → SQL Editor (idempotent).

alter table providers add column if not exists tier text not null default 'free' check (tier in ('free','pro'));
alter table providers add column if not exists categories service_category[] not null default '{}';
alter table providers add column if not exists pro_since timestamptz;

-- Nearby providers: match either the primary category or any of the Pro
-- provider's extra categories, and rank Pro providers first (priority
-- placement is one of the paid perks), then by distance.
-- The return columns changed (added tier, categories), and Postgres won't
-- let CREATE OR REPLACE change a table function's output shape, so drop it
-- first (safe: nothing else defines this function, callers just call it by
-- name/args again right after).
drop function if exists nearby_providers(double precision, double precision, service_category, double precision);
create or replace function nearby_providers(
  lat double precision,
  lng double precision,
  cat service_category default null,
  radius_km double precision default 10
)
returns table (
  id uuid, name text, category service_category,
  rating numeric, reviews int, verified boolean, online boolean,
  missions int, years_active int, response_rate int, bio text,
  tier text, categories service_category[],
  lat double precision, lng double precision, distance_km double precision
)
language sql stable as $$
  select p.id, p.name, p.category, p.rating, p.reviews, p.verified, p.online,
         p.missions, p.years_active, p.response_rate, p.bio,
         p.tier, p.categories,
         st_y(p.geo::geometry) as lat,
         st_x(p.geo::geometry) as lng,
         round((st_distance(p.geo, st_setsrid(st_makepoint(lng, lat),4326)::geography)/1000)::numeric, 2) as distance_km
  from providers p
  where p.online
    and (cat is null or p.category = cat or cat = any(p.categories))
    and st_dwithin(p.geo, st_setsrid(st_makepoint(lng, lat),4326)::geography, radius_km*1000)
  order by (p.tier = 'pro') desc, distance_km;
$$;
