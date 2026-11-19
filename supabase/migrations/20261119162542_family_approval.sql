-- New families wait for an admin's approval; until then they can't be used or joined.
-- Admins are granted by hand in the Supabase SQL editor:
--   insert into public.admins (user_id) select id from auth.users where email = '<email>';

create table public.admins (
  user_id uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null default now()
);
-- RLS on and no policies: the API can neither read nor write it, so nobody can make themselves admin.
alter table public.admins enable row level security;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

-- Families that existed before approvals were introduced stay approved.
alter table public.families
  add column status text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  add column requested_by uuid references auth.users on delete set null;
alter table public.families alter column status set default 'pending';
-- One open request per user (also guards against two requests racing).
create unique index families_one_pending_per_user on public.families (requested_by) where status = 'pending';

-- Only an admin changes status: members may rename their family, nothing else.
revoke update on public.families from anon, authenticated;
grant update (name) on public.families to authenticated;

-- Membership only counts in approved families: a pending family can't add children, items or transactions.
create or replace function public.is_member(fid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.family_members m join public.families f on f.id = m.family_id
                  where m.family_id = fid and m.user_id = auth.uid() and f.status = 'approved')
$$;

create or replace function public.is_parent(fid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.family_members m join public.families f on f.id = m.family_id
                  where m.family_id = fid and m.user_id = auth.uid() and m.role = 'parent' and f.status = 'approved')
$$;

-- The requester still sees their own family and membership, to show "pending" or "rejected".
drop policy "members read" on public.families;
create policy "members and requester read" on public.families for select to authenticated
  using (public.is_member(id) or requested_by = (select auth.uid()));
drop policy "members read" on public.family_members;
create policy "members read, own rows" on public.family_members for select to authenticated
  using (public.is_member(family_id) or user_id = (select auth.uid()));

create or replace function public.create_family(family_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare fid uuid;
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'sign in with email to create a family';
  end if;
  if exists (select 1 from public.families where requested_by = auth.uid() and status = 'pending') then
    raise exception 'family request already pending';
  end if;
  -- a new request replaces the user's rejected one
  delete from public.families where requested_by = auth.uid() and status = 'rejected';
  insert into public.families (name, requested_by, status)
    values (family_name, auth.uid(), case when public.is_admin() then 'approved' else 'pending' end)
    returning id into fid;
  insert into public.family_members (family_id, user_id, role, name)
    values (fid, auth.uid(), 'parent', coalesce(auth.jwt() ->> 'email', 'Padre/Madre'));
  return fid;
end $$;

create or replace function public.join_family(code text, member_name text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select id into fid from public.families where invite_code = lower(trim(code)) and status = 'approved';
  if fid is null then raise exception 'invalid invite code'; end if;
  insert into public.family_members (family_id, user_id, role, name)
    values (fid, auth.uid(), 'child',
            coalesce(nullif(trim(member_name), ''), nullif(auth.jwt() ->> 'email', ''), 'Dispositivo'))
    on conflict do nothing;
  return fid;
end $$;

-- Admin API. Each function checks is_admin() itself: they run as definer and bypass RLS.
-- The requester's email is shown only while a decision is pending (or after a rejection).
create function public.admin_families()
returns table (id uuid, name text, status text, created_at timestamptz, email text, parents int, kids int, movements int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  return query
    select f.id, f.name, f.status, f.created_at,
           case when f.status <> 'approved' then (select u.email::text from auth.users u where u.id = f.requested_by) end,
           (select count(*)::int from public.family_members m where m.family_id = f.id and m.role = 'parent'),
           (select count(*)::int from public.children c where c.family_id = f.id),
           (select count(*)::int from public.transactions t where t.family_id = f.id)
      from public.families f
     order by f.created_at desc;
end $$;

create function public.admin_set_family_status(fid uuid, new_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  update public.families set status = new_status where id = fid;
  if not found then raise exception 'family not found'; end if;
end $$;

create function public.admin_delete_family(fid uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  delete from public.families where id = fid; -- members, children, items and transactions cascade
  if not found then raise exception 'family not found'; end if;
end $$;

-- The "pending" screen updates itself when an admin decides.
alter publication supabase_realtime add table public.families;
