-- Sèvizi — Precise messaging access (run in Supabase → SQL Editor; idempotent)
--
-- A message thread belongs to exactly the two parties of a request/job: the
-- client who posted the request and the provider assigned to its job (plus the
-- sender). This replaces the older policy so messages are scoped correctly —
-- neither party's messages leak to unrelated accounts, and both parties can see
-- the full conversation.

drop policy if exists "msgs in own thread" on messages;
drop policy if exists "thread parties"    on messages;

create policy "thread parties" on messages for all using (
  sender_id = auth.uid()
  or exists (
    select 1 from requests r
    where r.id = messages.request_id and r.client_id = auth.uid()
  )
  or exists (
    select 1 from jobs j
    join providers p on p.id = j.provider_id
    where j.request_id = messages.request_id and p.user_id = auth.uid()
  )
) with check (
  sender_id = auth.uid()
);
