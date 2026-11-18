-- =====================================================================================
-- LoadMatch core database (stage 1: real companies)
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste all -> Run.
-- Safe to run on a new project. It does not touch the stage-0 demo table (loadmatch_events).
--
-- The flow this database follows:
--   SET UP      company -> units (factories, branches, godowns) -> people (owner adds them by phone)
--               -> items -> settings
--   CONNECT     search another company by GSTIN -> request -> they accept
--               -> each side adds it as a party (supplier / customer / job worker)
--               -> optional: match their item codes to ours
--   SEND        sender makes a load (lines, truck, driver, papers) -> loads the truck -> sends
--               -> everyone in the receiving company (or unit) who counts is told
--   RECEIVE     first person to count submits -> count is locked -> differences are worked out here,
--               on the server, not on the phone
--   DECIDE      each company decides its own side (debit note, take the loss, next bill, ...)
--               -> entries for the accountant -> packs sent to the accountant (Tally file)
--   Everything important is written to activity_log, which can never be edited.
--
-- Plain names in comments are what users see in the app.
-- =====================================================================================

create extension if not exists pgcrypto with schema extensions;  -- already on in Supabase

-- ---------------------------------------------------------------- 1. SET UP

-- A business using LoadMatch. One GSTIN = one company (a business with units in two states has two GSTINs:
-- the second state is a unit with its own GSTIN, not a second company, unless they run it as one).
create table public.companies (
  id               uuid primary key default gen_random_uuid(),
  legal_name       text not null check (length(trim(legal_name)) > 1),
  trade_name       text,                                   -- name on the board, shown in the app
  gstin            text unique check (gstin is null or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  pan              text check (pan is null or pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  gst_state_code   char(2),                                -- first 2 digits of the GSTIN, e.g. 29 = Karnataka
  address          text,
  city             text,
  pincode          text check (pincode is null or pincode ~ '^[1-9][0-9]{5}$'),
  phone            text,                                   -- office phone, used to find the company
  email            text,
  logo_path        text,                                   -- storage: company-files/<company>/logo.png
  letterhead_path  text,                                   -- printed on challans and dispatch slips
  discoverable     boolean not null default true,          -- can others find us by exact GSTIN or phone?
  created_at       timestamptz not null default now(),
  created_by       uuid                                    -- auth user of the first owner
);

-- Factories, branches and godowns of one company. "To our other unit" moves goods between these.
create table public.units (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  code            text not null,                            -- short code, e.g. MYS
  name            text not null,                            -- e.g. Mysuru unit
  kind            text not null default 'factory' check (kind in ('factory','branch','godown','shop','office')),
  gstin           text check (gstin is null or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  gst_state_code  char(2),
  address         text,
  city            text,
  pincode         text check (pincode is null or pincode ~ '^[1-9][0-9]{5}$'),
  phone           text,
  docks           text[] not null default '{}',             -- loading points, e.g. {Dock 1, Dock 2}
  tally_godown    text,                                     -- godown name in Tally
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (company_id, code)
);

-- People. The owner adds them by phone number; there is no public sign-up.
-- When that person first logs in with an OTP on that phone, auth_user_id is filled in.
create table public.members (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  auth_user_id  uuid,                                       -- Supabase auth user, set at first login
  name          text not null,
  phone         text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),   -- +919876543210
  role          text not null check (role in ('owner','manager','dispatch','receiver','accountant')),
  unit_ids      uuid[] not null default '{}',               -- empty = all units
  language      text not null default 'en' check (language in ('en','hi','kn','te')),
  active        boolean not null default true,
  added_by      uuid references public.members(id),
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz,
  unique (company_id, phone)
);
create index members_auth on public.members (auth_user_id) where auth_user_id is not null;

-- The owner's rules (Settings in the app)
create table public.company_settings (
  company_id          uuid primary key references public.companies(id) on delete cascade,
  receipt_hours       int not null default 24 check (receipt_hours between 1 and 720),   -- count late after this
  blind_count         boolean not null default true,       -- receiver does not see the sent quantity
  differences_to      text not null default 'all' check (differences_to in ('all','owner')),
  jobwork_days        int not null default 365,             -- GST: inputs must come back within 1 year
  eway_threshold      numeric(14,2) not null default 50000, -- ask for e-way bill above this value
  photos_required     boolean not null default false,       -- photo needed when there is a difference
  tally_company_name  text,
  updated_at          timestamptz not null default now(),
  updated_by          uuid references public.members(id)
);

-- What the company makes, buys and sends
create table public.items (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id) on delete cascade,
  code           text not null,
  name           text not null,
  uom            text not null default 'pcs',               -- pcs, kg, sheets, boxes, m ...
  hsn            text check (hsn is null or hsn ~ '^[0-9]{4,8}$'),
  gst_rate       numeric(5,2) check (gst_rate is null or gst_rate in (0,0.1,0.25,1.5,3,5,12,18,28,40)),
  rate           numeric(14,2) not null default 0 check (rate >= 0),   -- value per unit, for differences
  tolerance_qty  numeric(14,3) not null default 0,          -- e.g. weight loss allowed on the way
  tally_name     text,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (company_id, code)
);

-- ---------------------------------------------------------------- 2. CONNECT

-- One company asks another to connect. Only after "accepted" can loads go between them inside LoadMatch.
create table public.connections (
  id             uuid primary key default gen_random_uuid(),
  from_company   uuid not null references public.companies(id) on delete cascade,
  to_company     uuid not null references public.companies(id) on delete cascade,
  status         text not null default 'pending' check (status in ('pending','accepted','declined','ended')),
  message        text,
  requested_by   uuid references public.members(id),
  requested_at   timestamptz not null default now(),
  responded_by   uuid references public.members(id),
  responded_at   timestamptz,
  check (from_company <> to_company)
);
create unique index connections_pair on public.connections (least(from_company, to_company), greatest(from_company, to_company))
  where status in ('pending','accepted');

-- Suppliers, customers, job workers and transporters, as this company knows them.
-- linked_company is set when the party is a connected LoadMatch company; otherwise it is just a name
-- (they get WhatsApp links and count without logging in).
create table public.parties (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies(id) on delete cascade,
  kind             text not null check (kind in ('supplier','customer','jobworker','transporter')),
  name             text not null,
  gstin            text check (gstin is null or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  transporter_id   text,                                     -- TRANSIN for unregistered transporters
  gst_state_code   char(2),
  address          text,
  city             text,
  pincode          text check (pincode is null or pincode ~ '^[1-9][0-9]{5}$'),
  contact_name     text,
  contact_phone    text,                                     -- who gets the receiver link on WhatsApp
  tally_ledger     text,
  linked_company   uuid references public.companies(id),
  connection_id    uuid references public.connections(id),
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);
create index parties_company on public.parties (company_id, kind);

-- "Their item code = our item code", so the receiver sees their own names and Tally gets their own items
create table public.item_links (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies(id) on delete cascade,   -- whose mapping
  item_id          uuid not null references public.items(id) on delete cascade,       -- our item
  partner_company  uuid not null references public.companies(id) on delete cascade,
  partner_item_id  uuid references public.items(id) on delete cascade,
  partner_code     text,                                     -- if they have no item list yet
  factor           numeric(14,6) not null default 1,         -- 1 of theirs = factor of ours (box -> pcs)
  unique (company_id, partner_company, item_id)
);

-- ---------------------------------------------------------------- 3. SEND

create table public.load_counters (company_id uuid primary key references public.companies(id) on delete cascade, last_no int not null default 1000);

-- One truck. "Load 1021" in the app.
create table public.loads (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies(id) on delete cascade,  -- who made it
  load_no            int,                                    -- filled automatically: 1001, 1002 ...
  flow               text not null check (flow in ('transfer','inbound','outbound','jobwork_out','jobwork_in')),
  billing            text not null default 'none' check (billing in ('none','invoice')),
  from_unit          uuid references public.units(id),
  to_unit            uuid references public.units(id),
  party_id           uuid references public.parties(id),
  to_company         uuid references public.companies(id),   -- receiving company when it is on LoadMatch
  to_company_unit    uuid references public.units(id),       -- their unit, if known
  -- papers (the challan / invoice that travels with the truck)
  doc_type           text check (doc_type in ('tax_invoice','delivery_challan','bill_of_supply','supplier_bill','other')),
  doc_no             text not null,
  doc_date           date,
  doc_value          numeric(14,2),
  -- truck
  truck_no           text not null,
  driver_name        text,
  driver_phone       text,
  transporter_id     uuid references public.parties(id),
  lr_no              text,                                     -- lorry receipt (bilty)
  lr_date            date,
  eway_bill_no       text check (eway_bill_no is null or eway_bill_no ~ '^[0-9]{12}$'),
  eway_valid_until   timestamptz,
  -- links between loads
  parent_load        uuid references public.loads(id),        -- "made from" / job work return
  -- what happened
  status             text not null default 'draft' check (status in ('draft','loading','on_the_way','counted','matched','to_decide','waiting','closed','cancelled','came_back')),
  loading_point      text,
  loading_started_at timestamptz,
  loading_ended_at   timestamptz,
  sent_at            timestamptz,
  expected_by        timestamptz,
  cancelled_at       timestamptz,
  cancel_reason      text,
  notes              text,
  created_by         uuid references public.members(id),
  created_at         timestamptz not null default now(),
  unique (company_id, load_no),
  check (flow <> 'transfer' or (from_unit is not null and to_unit is not null and from_unit <> to_unit)),
  check (flow = 'transfer' or party_id is not null),
  check (cancelled_at is null or status in ('cancelled','came_back'))
);
create index loads_sender   on public.loads (company_id, status, created_at desc);
create index loads_receiver on public.loads (to_company, status, sent_at desc) where to_company is not null;

create table public.load_lines (
  id        uuid primary key default gen_random_uuid(),
  load_id   uuid not null references public.loads(id) on delete cascade,
  line_no   int not null check (line_no > 0),
  item_id   uuid not null references public.items(id),
  qty       numeric(14,3) not null check (qty > 0),
  uom       text not null,
  rate      numeric(14,2) not null default 0,               -- copied from the item when sent
  hsn       text,
  gst_rate  numeric(5,2),
  unique (load_id, line_no)
);

-- A WhatsApp link that lets someone count without logging in. Only a hash of the token is stored.
create table public.load_links (
  id          uuid primary key default gen_random_uuid(),
  load_id     uuid not null references public.loads(id) on delete cascade,
  purpose     text not null default 'count' check (purpose in ('count','evidence')),
  token_hash  text not null unique,
  sent_to     text,                                         -- phone it was shared with, if known
  created_by  uuid references public.members(id),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '30 days',
  revoked_at  timestamptz,
  opened_at   timestamptz
);

-- Who was told about an arriving load (everyone in the receiving company or unit who counts)
create table public.load_recipients (
  load_id      uuid not null references public.loads(id) on delete cascade,
  member_id    uuid not null references public.members(id) on delete cascade,
  notified_at  timestamptz not null default now(),
  opened_at    timestamptz,
  primary key (load_id, member_id)
);

-- ---------------------------------------------------------------- 4. RECEIVE

-- The count. Locked once submitted. A recount (owner only, with a reason) keeps the old one as history.
create table public.receipts (
  id             uuid primary key default gen_random_uuid(),
  load_id        uuid not null references public.loads(id) on delete cascade,
  counted_by     uuid references public.members(id),       -- set when a logged-in member counted
  counted_name   text not null,                             -- name typed on a link count
  via_link       uuid references public.load_links(id),
  note           text,
  submitted_at   timestamptz not null default now(),
  superseded_at  timestamptz,
  superseded_reason text
);
create unique index receipts_one_live on public.receipts (load_id) where superseded_at is null;

create table public.receipt_lines (
  receipt_id  uuid not null references public.receipts(id) on delete cascade,
  line_no     int not null,
  counted     numeric(14,3) not null check (counted >= 0),
  damaged     numeric(14,3) not null default 0 check (damaged >= 0),
  primary key (receipt_id, line_no),
  check (damaged <= counted)
);

-- Short / extra / damaged, one row per line and kind. Worked out by submit_receipt(), never typed.
create table public.differences (
  id          uuid primary key default gen_random_uuid(),
  load_id     uuid not null references public.loads(id) on delete cascade,
  receipt_id  uuid not null references public.receipts(id) on delete cascade,
  line_no     int not null,
  item_id     uuid not null references public.items(id),
  kind        text not null check (kind in ('short','excess','damaged')),
  qty         numeric(14,3) not null check (qty > 0),
  value       numeric(14,2) not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- 5. DECIDE

-- Each company decides its own side of a difference (the sender may raise a credit note
-- while the receiver raises a debit note). Undo = undone_at, never delete.
create table public.decisions (
  id                uuid primary key default gen_random_uuid(),
  difference_id     uuid not null references public.differences(id) on delete cascade,
  company_id        uuid not null references public.companies(id) on delete cascade,
  action            text not null check (action in ('write_off','debit_note','credit_note','adjust_next_bill','replacement','investigate','claim_transporter','extra_invoice','keep_extra','return_extra')),
  status            text not null default 'open' check (status in ('open','investigating','waiting','settled')),
  note              text,
  due_at            timestamptz,                             -- for promises (replacement, next bill)
  fulfilled_by_load uuid references public.loads(id),
  decided_by        uuid references public.members(id),
  decided_at        timestamptz not null default now(),
  settled_at        timestamptz,
  undone_at         timestamptz
);
create unique index decisions_one_live on public.decisions (difference_id, company_id) where undone_at is null;

-- Photos and papers: invoice, challan, e-way bill, bilty, damage, unloading. Files live in Storage.
create table public.documents (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id) on delete cascade,  -- whose file
  load_id        uuid references public.loads(id) on delete cascade,
  difference_id  uuid references public.differences(id) on delete cascade,
  kind           text not null check (kind in ('invoice','challan','eway_bill','bilty','order','damage','unloading','loading','other')),
  storage_path   text not null,                              -- load-files/<company>/<load>/<uuid>.jpg
  mime           text not null default 'image/jpeg',
  bytes          int check (bytes is null or bytes <= 5242880),
  taken_at       timestamptz,
  uploaded_by    uuid references public.members(id),
  uploaded_name  text,                                        -- for link uploads
  created_at     timestamptz not null default now()
);

-- CCTV: we store the time window and a link to the clip, never the video itself
create table public.cctv_refs (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id) on delete cascade,
  load_id        uuid references public.loads(id) on delete cascade,
  difference_id  uuid references public.differences(id) on delete cascade,
  unit_id        uuid references public.units(id),
  dock           text,
  camera         text,
  from_at        timestamptz not null,
  to_at          timestamptz not null check (to_at > from_at),
  clip_url       text,
  note           text,
  added_by       uuid references public.members(id),
  created_at     timestamptz not null default now()
);

-- Entries for the accountant (stock journal, debit note, credit note ...) and the packs sent to them
create table public.accountant_packs (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  created_by   uuid references public.members(id),
  created_at   timestamptz not null default now(),
  sent_at      timestamptz,
  undone_at    timestamptz,
  file_path    text                                          -- the Tally XML / report kept in Storage
);
create table public.accounting_entries (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  load_id       uuid references public.loads(id) on delete cascade,
  decision_id   uuid references public.decisions(id) on delete cascade,
  type          text not null check (type in ('stock_journal','branch_invoice','receipt_note','debit_note','credit_note','sales_invoice')),
  purpose       text not null check (purpose in ('dispatch','receipt','decision','reversal')),
  payload       jsonb not null,                              -- lines, party, narration: what goes to Tally
  status        text not null default 'pending' check (status in ('pending','sent','withdrawn')),
  pack_id       uuid references public.accountant_packs(id),
  created_at    timestamptz not null default now()
);

-- Everything that happened, for disputes. Can be added to, never changed or deleted.
create table public.activity_log (
  id          bigint generated always as identity primary key,
  company_id  uuid not null references public.companies(id) on delete cascade,
  load_id     uuid references public.loads(id) on delete cascade,
  actor       uuid references public.members(id),
  actor_name  text,
  action      text not null,
  detail      jsonb not null default '{}',
  at          timestamptz not null default now()
);
create index activity_load on public.activity_log (load_id, at);

-- ---------------------------------------------------------------- helper functions (run as the database owner)

-- Companies the logged-in person belongs to
create or replace function public.my_company_ids() returns setof uuid
language sql stable security definer set search_path = public, extensions as $$
  select company_id from members where auth_user_id = auth.uid() and active
$$;

create or replace function public.my_member_id(c uuid) returns uuid
language sql stable security definer set search_path = public, extensions as $$
  select id from members where auth_user_id = auth.uid() and company_id = c and active limit 1
$$;

create or replace function public.has_role(c uuid, roles text[]) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from members where auth_user_id = auth.uid() and company_id = c and active and role = any(roles))
$$;

create or replace function public.connected(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from connections where status = 'accepted'
    and ((from_company = a and to_company = b) or (from_company = b and to_company = a)))
$$;

-- Can I see this load? Sender's company, or the receiving company.
create or replace function public.can_see_load(l uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from loads where id = l
    and (company_id in (select my_company_ids()) or to_company in (select my_company_ids())))
$$;

create or replace function public.log(c uuid, l uuid, actor uuid, actor_name text, action text, detail jsonb default '{}')
returns void language sql security definer set search_path = public, extensions as $$
  insert into activity_log (company_id, load_id, actor, actor_name, action, detail) values (c, l, actor, actor_name, action, detail)
$$;

-- Load numbers: 1001, 1002 ... per company
create or replace function public.next_load_no() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  insert into load_counters (company_id) values (new.company_id) on conflict (company_id) do nothing;
  update load_counters set last_no = last_no + 1 where company_id = new.company_id returning last_no into new.load_no;
  return new;
end $$;
create trigger loads_number before insert on public.loads for each row when (new.load_no is null) execute function public.next_load_no();

-- ---------------------------------------------------------------- actions (all checks happen here, on the server)

-- First-time setup: the owner creates the company and becomes its owner
create or replace function public.create_company(p_legal_name text, p_trade_name text, p_gstin text, p_owner_name text, p_owner_phone text, p_city text default null)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare c uuid;
begin
  if auth.uid() is null then raise exception 'Please log in first'; end if;
  insert into companies (legal_name, trade_name, gstin, gst_state_code, city, created_by)
    values (trim(p_legal_name), nullif(trim(p_trade_name), ''), nullif(upper(trim(p_gstin)), ''), left(nullif(upper(trim(p_gstin)), ''), 2), p_city, auth.uid())
    returning id into c;
  insert into company_settings (company_id) values (c);
  insert into members (company_id, auth_user_id, name, phone, role) values (c, auth.uid(), trim(p_owner_name), p_owner_phone, 'owner');
  perform log(c, null, null, trim(p_owner_name), 'COMPANY_CREATED', jsonb_build_object('gstin', p_gstin));
  return c;
end $$;

-- At login: link the phone the owner added to this logged-in person (no sign-up form)
create or replace function public.claim_membership(p_phone text) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'Please log in first'; end if;
  -- the phone must be the one Supabase verified with the OTP
  if p_phone is distinct from (select '+' || ltrim(phone, '+') from auth.users where id = auth.uid()) then raise exception 'Phone does not match your login'; end if;
  update members set auth_user_id = auth.uid(), last_seen_at = now() where phone = p_phone and auth_user_id is null and active;
  get diagnostics n = row_count;
  return n;
end $$;

-- Find a company to connect with: exact GSTIN or exact phone only (no browsing of all companies)
create or replace function public.find_company(p_query text)
returns table (id uuid, name text, city text, gstin text)
language sql stable security definer set search_path = public, extensions as $$
  select c.id, coalesce(c.trade_name, c.legal_name), c.city, c.gstin from companies c
  where c.discoverable and auth.uid() is not null
    and (c.gstin = upper(trim(p_query)) or c.phone = trim(p_query))
  limit 5
$$;

create or replace function public.request_connection(p_from uuid, p_to uuid, p_message text default null) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare x uuid;
begin
  if not has_role(p_from, array['owner','manager']) then raise exception 'Only the owner or a manager can connect companies'; end if;
  insert into connections (from_company, to_company, message, requested_by) values (p_from, p_to, p_message, my_member_id(p_from)) returning id into x;
  perform log(p_from, null, my_member_id(p_from), null, 'CONNECTION_REQUESTED', jsonb_build_object('to', p_to));
  return x;
end $$;

create or replace function public.respond_connection(p_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare k connections;
begin
  select * into k from connections where id = p_id and status = 'pending';
  if k.id is null then raise exception 'Request not found'; end if;
  if not has_role(k.to_company, array['owner','manager']) then raise exception 'Only the owner or a manager can accept'; end if;
  update connections set status = case when p_accept then 'accepted' else 'declined' end, responded_by = my_member_id(k.to_company), responded_at = now() where id = p_id;
  perform log(k.to_company, null, my_member_id(k.to_company), null, case when p_accept then 'CONNECTION_ACCEPTED' else 'CONNECTION_DECLINED' end, jsonb_build_object('from', k.from_company));
end $$;

-- Send the truck: freezes the list, tells everyone who counts at the receiving side, returns a link token
create or replace function public.send_load(p_load uuid, p_share_link boolean default true) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare l loads; token text; recv uuid; recv_unit uuid;
begin
  select * into l from loads where id = p_load for update;
  if l.id is null or not has_role(l.company_id, array['owner','manager','dispatch']) then raise exception 'Not allowed'; end if;
  if l.sent_at is not null or l.cancelled_at is not null then raise exception 'Already sent or cancelled'; end if;
  if not exists (select 1 from load_lines where load_id = p_load) then raise exception 'Add at least one item'; end if;
  if l.to_company is not null and not connected(l.company_id, l.to_company) then raise exception 'That company is not connected'; end if;
  -- copy today's rates so later price changes do not change old differences
  update load_lines ll set rate = i.rate, hsn = i.hsn, gst_rate = i.gst_rate from items i where ll.load_id = p_load and i.id = ll.item_id;
  update loads set sent_at = now(), status = 'on_the_way', expected_by = coalesce(expected_by, now() + make_interval(hours => (select receipt_hours from company_settings where company_id = l.company_id))) where id = p_load;
  -- who counts: our own unit for a transfer, else the connected company (its unit if chosen)
  recv := case when l.flow in ('transfer','inbound','jobwork_in') then l.company_id else l.to_company end;
  recv_unit := case when l.flow in ('transfer','inbound','jobwork_in') then l.to_unit else l.to_company_unit end;
  if recv is not null then
    insert into load_recipients (load_id, member_id)
      select p_load, m.id from members m where m.company_id = recv and m.active and m.role in ('owner','manager','receiver')
        and (recv_unit is null or m.unit_ids = '{}' or recv_unit = any(m.unit_ids))
      on conflict do nothing;
  end if;
  -- a WhatsApp link for someone not on LoadMatch (a supplier's or customer's gate)
  if p_share_link then
    token := encode(gen_random_bytes(18), 'base64');
    token := translate(token, '+/=', '-_');
    insert into load_links (load_id, token_hash, created_by) values (p_load, encode(digest(token, 'sha256'), 'hex'), my_member_id(l.company_id));
  end if;
  perform log(l.company_id, p_load, my_member_id(l.company_id), null, 'SENT', jsonb_build_object('truck', l.truck_no));
  return token;
end $$;

-- What a link opens (no login): the load, its lines, and whether sent quantities are hidden
create or replace function public.load_for_link(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare k load_links; l loads; s company_settings; blind boolean;
begin
  select * into k from load_links where token_hash = encode(digest(p_token, 'sha256'), 'hex');
  if k.id is null or k.revoked_at is not null or k.expires_at < now() then return jsonb_build_object('error', 'link_not_valid'); end if;
  select * into l from loads where id = k.load_id;
  if l.cancelled_at is not null then return jsonb_build_object('error', 'load_cancelled'); end if;
  select * into s from company_settings where company_id = l.company_id;
  blind := coalesce(s.blind_count, true) and not exists (select 1 from receipts where load_id = l.id and superseded_at is null);
  update load_links set opened_at = coalesce(opened_at, now()) where id = k.id;
  return jsonb_build_object(
    'load_no', l.load_no, 'flow', l.flow, 'truck_no', l.truck_no, 'doc_no', l.doc_no, 'driver_name', l.driver_name, 'driver_phone', l.driver_phone,
    'from', coalesce((select name from units where id = l.from_unit), (select name from parties where id = l.party_id)),
    'to',   coalesce((select name from units where id = l.to_unit), (select name from parties where id = l.party_id)),
    'counted', exists (select 1 from receipts where load_id = l.id and superseded_at is null),
    'lines', (select jsonb_agg(jsonb_build_object('line_no', ll.line_no, 'item', i.name, 'uom', ll.uom, 'qty', case when blind then null else ll.qty end) order by ll.line_no)
              from load_lines ll join items i on i.id = ll.item_id where ll.load_id = l.id));
end $$;

-- Submit the count. Either a logged-in member of the receiving side, or anyone holding a valid link.
-- Locks the count and works out short / extra / damaged here, so a phone cannot fake the result.
create or replace function public.submit_receipt(p_load uuid, p_token text, p_name text, p_lines jsonb, p_note text default null) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare l loads; k load_links; recv uuid; member uuid; r uuid; ln record; c numeric; d numeric; n_diff int;
begin
  select * into l from loads where id = p_load for update;
  if l.id is null or l.sent_at is null or l.cancelled_at is not null then raise exception 'This load cannot be counted'; end if;
  recv := case when l.flow in ('transfer','inbound','jobwork_in') then l.company_id else l.to_company end;
  if p_token is not null then
    select * into k from load_links where load_id = p_load and purpose = 'count' and token_hash = encode(digest(p_token, 'sha256'), 'hex') and revoked_at is null and expires_at > now();
    if k.id is null then raise exception 'Link not valid'; end if;
  else
    if recv is null or not has_role(recv, array['owner','manager','receiver']) then raise exception 'Not allowed'; end if;
    member := my_member_id(recv);
  end if;
  if exists (select 1 from receipts where load_id = p_load and superseded_at is null) then raise exception 'Already counted and locked'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Name needed'; end if;
  insert into receipts (load_id, counted_by, counted_name, via_link, note) values (p_load, member, trim(p_name), k.id, p_note) returning id into r;
  for ln in select * from load_lines where load_id = p_load order by line_no loop
    c := (p_lines -> ln.line_no::text ->> 'counted')::numeric;
    d := coalesce((p_lines -> ln.line_no::text ->> 'damaged')::numeric, 0);
    if c is null then raise exception 'Line % not counted', ln.line_no; end if;
    insert into receipt_lines (receipt_id, line_no, counted, damaged) values (r, ln.line_no, c, d);
    if d > 0 then insert into differences (load_id, receipt_id, line_no, item_id, kind, qty, value) values (p_load, r, ln.line_no, ln.item_id, 'damaged', d, d * ln.rate); end if;
    if c < ln.qty - (select tolerance_qty from items where id = ln.item_id) then insert into differences (load_id, receipt_id, line_no, item_id, kind, qty, value) values (p_load, r, ln.line_no, ln.item_id, 'short', ln.qty - c, (ln.qty - c) * ln.rate); end if;
    if c > ln.qty then insert into differences (load_id, receipt_id, line_no, item_id, kind, qty, value) values (p_load, r, ln.line_no, ln.item_id, 'excess', c - ln.qty, (c - ln.qty) * ln.rate); end if;
  end loop;
  select count(*) into n_diff from differences where receipt_id = r;
  update loads set status = case when n_diff = 0 then 'matched' else 'to_decide' end where id = p_load;
  perform log(l.company_id, p_load, member, trim(p_name), 'COUNTED', jsonb_build_object('differences', n_diff, 'via_link', k.id is not null));
  return r;
end $$;

-- Owner only: the count was wrong. Keeps the old count as history; needs a reason; not after any decision.
create or replace function public.reopen_count(p_load uuid, p_reason text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare l loads;
begin
  select * into l from loads where id = p_load for update;
  if l.id is null or not (has_role(l.company_id, array['owner']) or (l.to_company is not null and has_role(l.to_company, array['owner']))) then raise exception 'Only the owner can ask for a recount'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Reason needed'; end if;
  if exists (select 1 from decisions dc join differences df on df.id = dc.difference_id where df.load_id = p_load and dc.undone_at is null and dc.action <> 'investigate') then raise exception 'A decision was already made'; end if;
  update receipts set superseded_at = now(), superseded_reason = trim(p_reason) where load_id = p_load and superseded_at is null;
  update loads set status = 'on_the_way' where id = p_load;
  perform log(l.company_id, p_load, my_member_id(l.company_id), null, 'RECOUNT_ASKED', jsonb_build_object('reason', p_reason));
end $$;

-- ---------------------------------------------------------------- who can see and change what (row level security)

alter table public.companies          enable row level security;
alter table public.units              enable row level security;
alter table public.members            enable row level security;
alter table public.company_settings   enable row level security;
alter table public.items              enable row level security;
alter table public.connections        enable row level security;
alter table public.parties            enable row level security;
alter table public.item_links         enable row level security;
alter table public.load_counters      enable row level security;
alter table public.loads              enable row level security;
alter table public.load_lines         enable row level security;
alter table public.load_links         enable row level security;
alter table public.load_recipients    enable row level security;
alter table public.receipts           enable row level security;
alter table public.receipt_lines      enable row level security;
alter table public.differences        enable row level security;
alter table public.decisions          enable row level security;
alter table public.documents          enable row level security;
alter table public.cctv_refs          enable row level security;
alter table public.accountant_packs   enable row level security;
alter table public.accounting_entries enable row level security;
alter table public.activity_log       enable row level security;

-- companies: my own, and companies I am connected to (their name, GSTIN, address go on papers)
create policy co_read on public.companies for select to authenticated
  using (id in (select my_company_ids()) or exists (select 1 from my_company_ids() m where connected(m, id)));
create policy co_edit on public.companies for update to authenticated using (has_role(id, array['owner'])) with check (has_role(id, array['owner']));

-- setup tables: everyone in the company reads; owner/manager change
create policy units_read on public.units for select to authenticated using (company_id in (select my_company_ids()) or exists (select 1 from my_company_ids() m where connected(m, company_id)));
create policy units_write on public.units for all to authenticated using (has_role(company_id, array['owner','manager'])) with check (has_role(company_id, array['owner','manager']));
create policy members_read on public.members for select to authenticated using (company_id in (select my_company_ids()));
create policy members_write on public.members for all to authenticated using (has_role(company_id, array['owner'])) with check (has_role(company_id, array['owner']));
create policy settings_read on public.company_settings for select to authenticated using (company_id in (select my_company_ids()));
create policy settings_write on public.company_settings for update to authenticated using (has_role(company_id, array['owner'])) with check (has_role(company_id, array['owner']));
create policy items_read on public.items for select to authenticated using (company_id in (select my_company_ids()) or exists (select 1 from my_company_ids() m where connected(m, company_id)));
create policy items_write on public.items for all to authenticated using (has_role(company_id, array['owner','manager'])) with check (has_role(company_id, array['owner','manager']));
create policy parties_read on public.parties for select to authenticated using (company_id in (select my_company_ids()));
create policy parties_write on public.parties for all to authenticated using (has_role(company_id, array['owner','manager','dispatch'])) with check (has_role(company_id, array['owner','manager','dispatch']));
create policy links_items_read on public.item_links for select to authenticated using (company_id in (select my_company_ids()));
create policy links_items_write on public.item_links for all to authenticated using (has_role(company_id, array['owner','manager'])) with check (has_role(company_id, array['owner','manager']));
create policy conn_read on public.connections for select to authenticated using (from_company in (select my_company_ids()) or to_company in (select my_company_ids()));
-- connections change only through request_connection / respond_connection

-- loads: sender's and receiver's company see them; the sender edits only before the truck leaves
create policy loads_read on public.loads for select to authenticated using (company_id in (select my_company_ids()) or to_company in (select my_company_ids()));
create policy loads_insert on public.loads for insert to authenticated with check (has_role(company_id, array['owner','manager','dispatch','receiver']) and sent_at is null);
create policy loads_edit on public.loads for update to authenticated using (has_role(company_id, array['owner','manager','dispatch']) and sent_at is null) with check (has_role(company_id, array['owner','manager','dispatch']));
create policy lines_read on public.load_lines for select to authenticated using (can_see_load(load_id));
create policy lines_write on public.load_lines for all to authenticated
  using (exists (select 1 from loads l where l.id = load_id and l.sent_at is null and has_role(l.company_id, array['owner','manager','dispatch','receiver'])))
  with check (exists (select 1 from loads l where l.id = load_id and l.sent_at is null and has_role(l.company_id, array['owner','manager','dispatch','receiver'])));
create policy recipients_read on public.load_recipients for select to authenticated using (can_see_load(load_id));
-- load_links: no direct access at all (only through send_load / load_for_link / submit_receipt)

-- counts and differences: read by both sides; written only by submit_receipt / reopen_count
create policy receipts_read on public.receipts for select to authenticated using (can_see_load(load_id));
create policy rlines_read on public.receipt_lines for select to authenticated using (exists (select 1 from receipts r where r.id = receipt_id and can_see_load(r.load_id)));
create policy diffs_read on public.differences for select to authenticated using (can_see_load(load_id));

-- decisions: each company sees and makes only its own
create policy decisions_read on public.decisions for select to authenticated using (company_id in (select my_company_ids()));
create policy decisions_write on public.decisions for all to authenticated using (has_role(company_id, array['owner','manager'])) with check (has_role(company_id, array['owner','manager']));

-- papers, photos, CCTV: each company keeps its own; both sides of a load may add to it
create policy docs_read on public.documents for select to authenticated using (company_id in (select my_company_ids()) or (load_id is not null and can_see_load(load_id)));
create policy docs_add on public.documents for insert to authenticated with check (company_id in (select my_company_ids()) and (load_id is null or can_see_load(load_id)));
create policy cctv_read on public.cctv_refs for select to authenticated using (company_id in (select my_company_ids()));
create policy cctv_add on public.cctv_refs for insert to authenticated with check (has_role(company_id, array['owner','manager']));

-- accountant: owner, manager, accountant of that company only
create policy packs_rw on public.accountant_packs for all to authenticated using (has_role(company_id, array['owner','manager','accountant'])) with check (has_role(company_id, array['owner','manager','accountant']));
create policy entries_rw on public.accounting_entries for all to authenticated using (has_role(company_id, array['owner','manager','accountant'])) with check (has_role(company_id, array['owner','manager','accountant']));

-- history: read only; written by the actions above
create policy log_read on public.activity_log for select to authenticated using (company_id in (select my_company_ids()) or (load_id is not null and can_see_load(load_id)));

-- people not logged in (link users) get nothing directly; only these two actions
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from public, anon;
-- keep the stage-0 demo table usable by today's app
grant select, insert on public.loadmatch_events to anon, authenticated;
grant execute on function public.load_for_link(text) to anon, authenticated;
grant execute on function public.submit_receipt(uuid, text, text, jsonb, text) to anon, authenticated;
grant execute on function public.create_company(text, text, text, text, text, text), public.claim_membership(text), public.find_company(text),
  public.request_connection(uuid, uuid, text), public.respond_connection(uuid, boolean), public.send_load(uuid, boolean),
  public.reopen_count(uuid, text), public.my_company_ids(), public.my_member_id(uuid), public.has_role(uuid, text[]),
  public.connected(uuid, uuid), public.can_see_load(uuid) to authenticated;
-- a link user submits by load id + token; make sure the token, not the id, is what opens the door
comment on function public.submit_receipt is 'p_token null = logged-in member of the receiving side; otherwise the WhatsApp link token.';

-- ---------------------------------------------------------------- storage for photos and papers (private)
-- Path: load-files/<company id>/<load id>/<file>. Photos are shrunk on the phone to ~100-200 KB first.
insert into storage.buckets (id, name, public) values ('load-files', 'load-files', false) on conflict (id) do nothing;
create policy files_read on storage.objects for select to authenticated
  using (bucket_id = 'load-files' and ((storage.foldername(name))[1]::uuid in (select my_company_ids()) or can_see_load(((storage.foldername(name))[2])::uuid)));
create policy files_add on storage.objects for insert to authenticated
  with check (bucket_id = 'load-files' and (storage.foldername(name))[1]::uuid in (select my_company_ids()));

-- ---------------------------------------------------------------- live updates on phones
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.loads, public.receipts, public.differences, public.decisions, public.load_recipients;
  end if;
end $$;
