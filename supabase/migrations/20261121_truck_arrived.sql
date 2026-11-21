-- LoadMatch: the store person taps "Truck arrived" (drivers don't use the app).
-- Run once in Supabase → SQL Editor. Safe to run again.
alter table public.loads add column if not exists arrived_at timestamptz;
alter table public.loads add column if not exists arrived_by uuid references public.members(id);

-- new status between on_the_way and counted
alter table public.loads drop constraint if exists loads_status_check;
alter table public.loads add constraint loads_status_check
  check (status in ('draft','loading','on_the_way','arrived','counted','matched','to_decide','waiting','closed','cancelled','came_back'));

-- arrived only after the truck left
alter table public.loads drop constraint if exists loads_arrived_after_sent;
alter table public.loads add constraint loads_arrived_after_sent check (arrived_at is null or (sent_at is not null and arrived_at >= sent_at));

-- A supplier delivery the owner expects (added when the order is placed); the store marks it arrived and counts it.
alter table public.loads add column if not exists expected_on date;
alter table public.loads drop constraint if exists loads_expected_inbound;
alter table public.loads add constraint loads_expected_inbound check (expected_on is null or flow in ('inbound','jobwork_in'));
