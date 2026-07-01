-- Sèvizi — Reviews: recompute provider rating + notify provider on new review
-- Run in Supabase → SQL Editor (idempotent).

-- One review per job (a job has a single client).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'reviews_job_unique') then
    alter table reviews add constraint reviews_job_unique unique (job_id);
  end if;
end $$;

-- When a review lands: recompute the provider's average rating + review count
-- (SECURITY DEFINER — the client isn't allowed to update the provider row),
-- and notify the provider.
create or replace function on_new_review() returns trigger
language plpgsql security definer as $$
declare v_avg numeric; v_count int; v_user uuid;
begin
  select round(avg(rating)::numeric, 1), count(*)
    into v_avg, v_count
    from reviews where provider_id = new.provider_id;

  update providers
    set rating  = coalesce(v_avg, 0),
        reviews = coalesce(v_count, 0)
    where id = new.provider_id;

  select user_id into v_user from providers where id = new.provider_id;
  if v_user is not null then
    insert into notifications (user_id, type, title, body, action_route)
    values (v_user, 'review', 'Nouvel avis ⭐',
            coalesce(new.author_name, 'Un client') || ' vous a laissé ' || new.rating || '/5.',
            '/provider/profile');
  end if;

  return new;
end; $$;

drop trigger if exists trg_on_new_review on reviews;
create trigger trg_on_new_review after insert on reviews
  for each row execute function on_new_review();
