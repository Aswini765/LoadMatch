-- LoadMatch: email-code login for the pilot (phone OTP later, after DLT registration).
-- People can be added by email, by phone, or both. At first login they are matched by the
-- email (or phone) that Supabase verified.

alter table public.members alter column phone drop not null;
alter table public.members add column if not exists email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');
alter table public.members drop constraint if exists members_contact;
alter table public.members add constraint members_contact check (phone is not null or email is not null);
create unique index if not exists members_company_email on public.members (company_id, lower(email)) where email is not null;

-- First-time setup: the owner (logged in) creates the company and becomes its owner
create or replace function public.create_company(p_legal_name text, p_trade_name text, p_gstin text, p_owner_name text, p_owner_phone text, p_city text default null)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare c uuid; me_email text; me_phone text;
begin
  if auth.uid() is null then raise exception 'Please log in first'; end if;
  if exists (select 1 from members where auth_user_id = auth.uid() and role = 'owner' and active) then raise exception 'You already own a company'; end if;
  select email, phone into me_email, me_phone from auth.users where id = auth.uid();
  insert into companies (legal_name, trade_name, gstin, gst_state_code, city, created_by)
    values (trim(p_legal_name), nullif(trim(p_trade_name), ''), nullif(upper(trim(p_gstin)), ''), left(nullif(upper(trim(p_gstin)), ''), 2), nullif(trim(p_city), ''), auth.uid())
    returning id into c;
  insert into company_settings (company_id) values (c);
  insert into members (company_id, auth_user_id, name, phone, email, role)
    values (c, auth.uid(), trim(p_owner_name), nullif(trim(coalesce(p_owner_phone, '')), ''), me_email, 'owner');
  perform log(c, null, null, trim(p_owner_name), 'COMPANY_CREATED', jsonb_build_object('gstin', p_gstin));
  return c;
end $$;

-- At login: link every place the owner added this person (by verified email or phone)
create or replace function public.claim_membership() returns int
language plpgsql security definer set search_path = public, extensions as $$
declare n int; me_email text; me_phone text;
begin
  if auth.uid() is null then raise exception 'Please log in first'; end if;
  select lower(email), case when phone is null or phone = '' then null else '+' || ltrim(phone, '+') end into me_email, me_phone from auth.users where id = auth.uid();
  update members set auth_user_id = auth.uid(), last_seen_at = now()
    where auth_user_id is null and active
      and ((me_email is not null and lower(email) = me_email) or (me_phone is not null and phone = me_phone));
  get diagnostics n = row_count;
  return n;
end $$;

drop function if exists public.claim_membership(text);
revoke execute on function public.claim_membership(), public.create_company(text, text, text, text, text, text) from public, anon;
grant execute on function public.claim_membership(), public.create_company(text, text, text, text, text, text) to authenticated;

-- The demo screens keep working after someone logs in (their requests then come as "authenticated")
drop policy if exists "demo read signed in" on public.loadmatch_events;
create policy "demo read signed in" on public.loadmatch_events for select to authenticated using (workspace = 'demo');
drop policy if exists "demo insert signed in" on public.loadmatch_events;
create policy "demo insert signed in" on public.loadmatch_events for insert to authenticated with check (workspace = 'demo' and pg_column_size(action) < 20000);
