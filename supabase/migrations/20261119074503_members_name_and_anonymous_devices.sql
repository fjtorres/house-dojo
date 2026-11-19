-- Children's devices sign in anonymously and join with an invite code.
-- Only real (email) accounts can found a family; members get a name so parents know who is who.

alter table public.family_members add column name text not null default 'Dispositivo'
  check (length(name) between 1 and 60);

create or replace function public.create_family(family_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare fid uuid;
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'sign in with email to create a family';
  end if;
  insert into public.families (name) values (family_name) returning id into fid;
  insert into public.family_members (family_id, user_id, role, name)
    values (fid, auth.uid(), 'parent', coalesce(auth.jwt() ->> 'email', 'Padre/Madre'));
  return fid;
end $$;

drop function public.join_family(text);

create function public.join_family(code text, member_name text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select id into fid from public.families where invite_code = lower(trim(code));
  if fid is null then raise exception 'invalid invite code'; end if;
  insert into public.family_members (family_id, user_id, role, name)
    values (fid, auth.uid(), 'child',
            coalesce(nullif(trim(member_name), ''), nullif(auth.jwt() ->> 'email', ''), 'Dispositivo'))
    on conflict do nothing;
  return fid;
end $$;
