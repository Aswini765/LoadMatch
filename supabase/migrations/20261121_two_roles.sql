-- LoadMatch: two roles (Staff + Owner) and staff requests to the owner.
-- Run once in Supabase → SQL Editor. Safe to run again.
-- The live demo still uses loadmatch_events; this keeps the full schema in step with the app.

-- 1. Role "staff": one person per unit who both sends and receives (replaces dispatch + receiver).
alter table public.members drop constraint if exists members_role_check;
alter table public.members add constraint members_role_check
  check (role in ('owner','manager','staff','dispatch','receiver','accountant'));  -- old values kept so old rows stay valid

-- Staff can do everything dispatch or receiver could, without rewriting every policy.
create or replace function public.has_role(c uuid, roles text[]) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1 from members
    where auth_user_id = auth.uid() and company_id = c and active
      and (role = any(roles) or (role = 'staff' and roles && array['dispatch','receiver']))
  )
$$;

-- 2. Staff ask, the owner decides: change truck details, truck came back, accident, add an item or party.
create table if not exists public.owner_requests (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  load_id       uuid references public.loads(id) on delete cascade,      -- empty for "add item / party"
  kind          text not null check (kind in ('details','came_back','accident','add_item','add_party')),
  outcome       text check (outcome is null or outcome in ('moved','returned')),   -- accident only
  details       jsonb not null default '{}',     -- new truck no., driver, or the item / party name
  note          text not null default '',
  place         text,
  asked_by      uuid references public.members(id),
  asked_at      timestamptz not null default now(),
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  decided_by    uuid references public.members(id),
  decided_at    timestamptz,
  decided_note  text,
  check (kind in ('add_item','add_party') or load_id is not null),
  check (kind <> 'accident' or outcome is not null)
);
-- one open request per load at a time
create unique index if not exists owner_requests_one_open on public.owner_requests (load_id) where status = 'pending' and load_id is not null;
create index if not exists owner_requests_company on public.owner_requests (company_id, status, asked_at desc);

alter table public.owner_requests enable row level security;
drop policy if exists owner_requests_read on public.owner_requests;
create policy owner_requests_read on public.owner_requests for select to authenticated
  using (company_id in (select my_company_ids()));
drop policy if exists owner_requests_ask on public.owner_requests;
create policy owner_requests_ask on public.owner_requests for insert to authenticated
  with check (has_role(company_id, array['staff','owner','manager']) and status = 'pending');
-- only the owner (or manager) decides
drop policy if exists owner_requests_decide on public.owner_requests;
create policy owner_requests_decide on public.owner_requests for update to authenticated
  using (has_role(company_id, array['owner','manager'])) with check (has_role(company_id, array['owner','manager']));
