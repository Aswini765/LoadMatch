-- LoadMatch shared data: one append-only event log per workspace.
-- Every device replays these events through the same reducer, so all phones and laptops agree.
-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

create table if not exists public.loadmatch_events (
  id bigint generated always as identity primary key,
  workspace text not null default 'demo',
  action jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists loadmatch_events_ws_id on public.loadmatch_events (workspace, id);

alter table public.loadmatch_events enable row level security;

-- DEMO POLICY: anyone with the site's public (anon) key can read and add events for the demo workspace.
-- Events can never be edited or deleted from the app. A receiver link carries a token, but in this demo
-- the token is checked in the app, not by the database. Before real customer data goes in, add
-- Supabase Auth with one policy per business, and validate receiver tokens on the server.
drop policy if exists "demo read" on public.loadmatch_events;
create policy "demo read" on public.loadmatch_events
  for select to anon using (workspace = 'demo');

drop policy if exists "demo insert" on public.loadmatch_events;
create policy "demo insert" on public.loadmatch_events
  for insert to anon with check (workspace = 'demo' and pg_column_size(action) < 20000);

-- Live updates to every open device
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'loadmatch_events'
  ) then
    alter publication supabase_realtime add table public.loadmatch_events;
  end if;
end $$;
