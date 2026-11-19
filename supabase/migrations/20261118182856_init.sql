-- House Dojo: each family is an isolated tenant. Access is enforced by RLS, never by the client.

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  invite_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  created_at timestamptz not null default now()
);

create table public.family_members (
  family_id uuid not null references public.families on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('parent', 'child')),
  primary key (family_id, user_id)
);
create index on public.family_members (user_id);

create table public.children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families on delete cascade,
  name text not null check (length(name) between 1 and 40),
  avatar text,
  color text,
  created_at timestamptz not null default now(),
  unique (id, family_id)
);

-- Items are archived, not deleted, once used: transactions keep pointing at them.
create table public.items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families on delete cascade,
  kind text not null check (kind in ('earn', 'penalty', 'reward')),
  name text not null check (length(name) between 1 and 60),
  icon text,
  points int not null check (points > 0),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, family_id)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families on delete cascade,
  child_id uuid not null,
  item_id uuid not null,
  points int not null, -- signed snapshot, set by trigger from the item
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now(),
  -- composite keys stop a transaction from mixing a child or item of another family
  foreign key (child_id, family_id) references public.children (id, family_id) on delete cascade,
  foreign key (item_id, family_id) references public.items (id, family_id)
);
create index on public.transactions (child_id, created_at desc);

-- The client never decides how many points a transaction is worth.
create function public.set_transaction_points() returns trigger
language plpgsql set search_path = '' as $$
begin
  select case i.kind when 'earn' then i.points else -i.points end
    into new.points
    from public.items i
   where i.id = new.item_id and i.family_id = new.family_id;
  return new;
end $$;

create trigger set_points before insert on public.transactions
  for each row execute function public.set_transaction_points();

create view public.child_balances with (security_invoker = true) as
select c.id as child_id,
       c.family_id,
       coalesce(sum(t.points) filter (where t.status = 'approved'), 0)::int as points
  from public.children c
  left join public.transactions t on t.child_id = c.id
 group by c.id;

-- security definer: reading family_members inside its own policies would recurse.
create function public.is_member(fid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.family_members where family_id = fid and user_id = auth.uid())
$$;

create function public.is_parent(fid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.family_members
                  where family_id = fid and user_id = auth.uid() and role = 'parent')
$$;

create function public.create_family(family_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.families (name) values (family_name) returning id into fid;
  insert into public.family_members (family_id, user_id, role) values (fid, auth.uid(), 'parent');
  return fid;
end $$;

-- Joining grants the least privilege; a parent promotes the member if needed.
create function public.join_family(code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select id into fid from public.families where invite_code = code;
  if fid is null then raise exception 'invalid invite code'; end if;
  insert into public.family_members (family_id, user_id, role)
    values (fid, auth.uid(), 'child') on conflict do nothing;
  return fid;
end $$;

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.children enable row level security;
alter table public.items enable row level security;
alter table public.transactions enable row level security;

-- One policy per action (members read, parents write) keeps RLS to a single check per row.
create policy "members read" on public.families for select to authenticated using (public.is_member(id));
create policy "parents update" on public.families for update to authenticated using (public.is_parent(id));
create policy "parents delete" on public.families for delete to authenticated using (public.is_parent(id));

create policy "members read" on public.family_members for select to authenticated
  using (public.is_member(family_id));
create policy "parents update" on public.family_members for update to authenticated
  using (public.is_parent(family_id)) with check (public.is_parent(family_id));
create policy "parents remove, anyone leaves" on public.family_members for delete to authenticated
  using (public.is_parent(family_id) or user_id = (select auth.uid()));

create policy "members read" on public.children for select to authenticated using (public.is_member(family_id));
create policy "parents insert" on public.children for insert to authenticated with check (public.is_parent(family_id));
create policy "parents update" on public.children for update to authenticated
  using (public.is_parent(family_id)) with check (public.is_parent(family_id));
create policy "parents delete" on public.children for delete to authenticated using (public.is_parent(family_id));

create policy "members read" on public.items for select to authenticated using (public.is_member(family_id));
create policy "parents insert" on public.items for insert to authenticated with check (public.is_parent(family_id));
create policy "parents update" on public.items for update to authenticated
  using (public.is_parent(family_id)) with check (public.is_parent(family_id));
create policy "parents delete" on public.items for delete to authenticated using (public.is_parent(family_id));

create policy "members read" on public.transactions for select to authenticated using (public.is_member(family_id));
-- Parents record anything; children only propose pending transactions in their own name.
create policy "parents record, members propose" on public.transactions for insert to authenticated
  with check (public.is_parent(family_id)
              or (status = 'pending' and created_by = (select auth.uid()) and public.is_member(family_id)));
create policy "parents update" on public.transactions for update to authenticated
  using (public.is_parent(family_id)) with check (public.is_parent(family_id));
create policy "parents delete" on public.transactions for delete to authenticated using (public.is_parent(family_id));

-- Live sync across devices.
alter publication supabase_realtime add table public.children, public.items, public.transactions;
