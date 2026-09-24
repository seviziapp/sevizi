-- Sèvizi — ONE-TIME backfill: turn on the verified badge for requests an admin
-- already approved.
--
-- Until migration_lock_down_verification.sql, protect_provider_tier_columns
-- reverted providers.verified for every authenticated caller (admins
-- included), so approving a verification marked the request approved but never
-- set the badge. Run once. Deliberately NOT part of setup.sql: re-running it
-- later would re-badge an account whose badge was revoked on purpose.
update providers set verified = true
where verified is not true
  and id in (select provider_id from verification_requests
             where status = 'approved' and provider_id is not null);

update profiles set verified = true
where verified is not true
  and id in (select user_id from verification_requests
             where status = 'approved' and type = 'client' and user_id is not null);
