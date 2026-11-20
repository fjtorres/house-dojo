begin;
select plan(13);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'parent@test'),
  ('22222222-2222-2222-2222-222222222222', 'tablet@test'),
  ('33333333-3333-3333-3333-333333333333', 'outsider@test');
insert into families (id, name, status) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Dojo', 'approved');
insert into family_members (family_id, user_id, role, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'parent', 'Papá'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'child', 'Tablet');
insert into children (id, family_id, name) values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Ana');
insert into items (id, family_id, kind, name, points) values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'earn', 'Deberes', 10);

create function pg_temp.login(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.propose(tid uuid, status text default 'pending', created_by uuid default auth.uid()) returns void language sql as $$
  insert into public.transactions (id, family_id, child_id, item_id, points, status, created_by)
  values (tid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 0, status, created_by)
$$;
-- "action by actor_name (actor_role)" per event, oldest first
create function pg_temp.trail(tid uuid) returns text[] language sql security definer as $$
  select array_agg(format('%s by %s (%s)', action, coalesce(actor_name, '?'), coalesce(actor_role, '?')) order by id)
    from public.transaction_events where transaction_id = tid
$$;

set local role authenticated;

-- Kid proposes, parent approves, parent undoes
select pg_temp.login('22222222-2222-2222-2222-222222222222');
select pg_temp.propose('00000000-0000-0000-0000-000000000001');
select pg_temp.login('11111111-1111-1111-1111-111111111111');
update transactions set status = 'approved' where id = '00000000-0000-0000-0000-000000000001';
update transactions set status = 'approved' where id = '00000000-0000-0000-0000-000000000001';
update transactions set status = 'rejected' where id = '00000000-0000-0000-0000-000000000001';
select is(pg_temp.trail('00000000-0000-0000-0000-000000000001'),
  array['created by Tablet (child)', 'approved by Papá (parent)', 'undone by Papá (parent)'],
  'proposal, approval and undo are logged with who did them; a no-op update logs nothing');
select is((select actor_id from transaction_events where action = 'created'
            and transaction_id = '00000000-0000-0000-0000-000000000001'),
  '22222222-2222-2222-2222-222222222222'::uuid, 'actor is the signed-in user');
select ok((select bool_and(created_at is not null) from transaction_events), 'every event has a date');

-- Parent rejects a pending proposal
select pg_temp.login('22222222-2222-2222-2222-222222222222');
select pg_temp.propose('00000000-0000-0000-0000-000000000002');
select pg_temp.login('11111111-1111-1111-1111-111111111111');
update transactions set status = 'rejected' where id = '00000000-0000-0000-0000-000000000002';
select is(pg_temp.trail('00000000-0000-0000-0000-000000000002'),
  array['created by Tablet (child)', 'rejected by Papá (parent)'], 'rejecting a proposal is not an undo');

-- Parent records an approved movement directly, claiming the kid created it
select pg_temp.propose('00000000-0000-0000-0000-000000000003', 'approved', '22222222-2222-2222-2222-222222222222');
select is(pg_temp.trail('00000000-0000-0000-0000-000000000003'),
  array['created by Papá (parent)', 'approved by Papá (parent)'],
  'direct record logs creation and approval, by whoever is signed in, not by created_by');

-- Nobody writes the trail through the API
select throws_ok($$ insert into transaction_events (transaction_id, family_id, action)
                    values ('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'approved') $$,
  '42501', null, 'parent cannot insert events');
select throws_ok($$ update transaction_events set actor_name = 'Otro' $$, '42501', null, 'parent cannot edit events');
select throws_ok($$ delete from transaction_events $$, '42501', null, 'parent cannot delete events');
select pg_temp.login('22222222-2222-2222-2222-222222222222');
select throws_ok($$ insert into transaction_events (transaction_id, family_id, action)
                    values ('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'approved') $$,
  '42501', null, 'kid cannot insert events');
select is((select count(*)::int from transaction_events), 7, 'family members read their trail');

select pg_temp.login('33333333-3333-3333-3333-333333333333');
select is((select count(*)::int from transaction_events), 0, 'another family sees no events');

-- The trail survives the actor leaving the family
reset role;
delete from family_members where user_id = '22222222-2222-2222-2222-222222222222';
select is((pg_temp.trail('00000000-0000-0000-0000-000000000001'))[1], 'created by Tablet (child)',
  'actor name is kept after they leave');
delete from transactions where id = '00000000-0000-0000-0000-000000000001';
select is(pg_temp.trail('00000000-0000-0000-0000-000000000001'), null, 'events go with their movement');

select * from finish();
rollback;
