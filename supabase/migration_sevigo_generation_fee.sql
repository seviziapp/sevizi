-- Sèvi Go — invoice generation fee gate. Run in Supabase → SQL Editor. Idempotent.
--
-- Problem: a business owner could create an invoice, screenshot/print it,
-- collect payment from their own client outside the app, and never actually
-- pay Sèvi Go's per-invoice fee (pay-as-you-go, or Starter/Growth overage).
-- Fix: when a fee applies, the invoice is created in a locked 'pending_fee'
-- state — no content is meant to be shown/shared/printed while in this
-- state — until the business owner pays that fee via PayDunya, confirmed by
-- sevigo-generation-fee-webhook, which flips it to 'draft'.

alter table sevigo_invoices drop constraint if exists sevigo_invoices_status_check;
alter table sevigo_invoices add constraint sevigo_invoices_status_check
  check (status in ('pending_fee','draft','sent','paid','overdue','cancelled'));

create table if not exists sevigo_invoice_generation_fees (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references sevigo_invoices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount int not null,
  status text not null default 'pending' check (status in ('pending','completed','failed','cancelled')),
  paydunya_token text unique,
  created_at timestamptz default now(),
  confirmed_at timestamptz
);
create index if not exists sevigo_invoice_generation_fees_invoice_idx on sevigo_invoice_generation_fees(invoice_id);

alter table sevigo_invoice_generation_fees enable row level security;
create policy "own generation fees" on sevigo_invoice_generation_fees for select using (auth.uid() = user_id);
