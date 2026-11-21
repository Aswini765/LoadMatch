-- LoadMatch: Accountant to-do list, owner sends the customer count link, plain decision choices.
-- Run once in Supabase → SQL Editor. Safe to run again.

-- 1. The owner (not staff) sends the count link to the customer; remember when.
alter table public.loads add column if not exists link_sent_at timestamptz;

-- 2. Decision choices the app offers now (old values kept so old rows stay valid).
alter table public.decisions drop constraint if exists decisions_action_check;
alter table public.decisions add constraint decisions_action_check check (action in (
  -- between our own units
  'unit_sends_rest','claim','correct_list','write_off',
  -- supplier
  'replace','debit_note','keep_extra','return_extra',
  -- customer
  'send_rest','send_replacement','credit_note','bill_extra','customer_returns',
  -- everyone
  'investigate',
  -- older values
  'adjust_next_bill','replacement','claim_transporter','extra_invoice','accept'));

-- 3. The accountant ticks each to-do when it is done in Tally.
alter table public.accounting_entries add column if not exists done_at timestamptz;
alter table public.accounting_entries add column if not exists done_by uuid references public.members(id);

-- 4. Accountants read their company's entries and mark them done; nobody else marks them.
drop policy if exists accounting_entries_done on public.accounting_entries;
create policy accounting_entries_done on public.accounting_entries for update to authenticated
  using (has_role(company_id, array['accountant','owner','manager']))
  with check (has_role(company_id, array['accountant','owner','manager']));
