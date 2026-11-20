-- Audit trail of every movement: who created, approved, rejected or undid it, and when.
-- Written only by a trigger from auth.uid() and now(), so the client can't forge who or when.

create table public.transaction_events (
  id bigint generated always as identity primary key,
  transaction_id uuid not null references public.transactions on delete cascade,
  family_id uuid not null references public.families on delete cascade,
  action text not null check (action in ('created', 'approved', 'rejected', 'undone')),
  actor_id uuid references auth.users on delete set null,
  -- snapshot of the actor's member name and role: still readable after they leave the family
  actor_name text,
  actor_role text,
  created_at timestamptz not null default now()
);
create index on public.transaction_events (transaction_id);

alter table public.transaction_events enable row level security;
create policy "members read" on public.transaction_events for select to authenticated
  using (public.is_member(family_id));
-- Append-only from the API's point of view: nobody writes it but the trigger below.
revoke insert, update, delete on public.transaction_events from anon, authenticated;

create function public.log_transaction_event() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  actions text[];
  actor public.family_members;
begin
  if tg_op = 'INSERT' then
    -- a parent records an approved movement in one go: log both steps
    actions := case when new.status = 'approved' then array['created', 'approved'] else array['created'] end;
  elsif new.status is distinct from old.status then
    actions := array[case
      when new.status = 'approved' then 'approved'
      when old.status = 'approved' then 'undone'
      else 'rejected' end];
  else
    return new;
  end if;
  select * into actor from public.family_members where family_id = new.family_id and user_id = auth.uid();
  insert into public.transaction_events (transaction_id, family_id, action, actor_id, actor_name, actor_role)
    select new.id, new.family_id, a, auth.uid(), actor.name, actor.role from unnest(actions) a;
  return new;
end $$;

create trigger log_event after insert or update of status on public.transactions
  for each row execute function public.log_transaction_event();

-- Movements from before this migration: only their creation is known.
insert into public.transaction_events (transaction_id, family_id, action, actor_id, actor_name, actor_role, created_at)
select t.id, t.family_id, 'created', t.created_by, m.name, m.role, t.created_at
  from public.transactions t
  left join public.family_members m on m.family_id = t.family_id and m.user_id = t.created_by;
