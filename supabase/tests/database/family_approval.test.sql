begin;
select plan(20);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'requester@test'),
  ('22222222-2222-2222-2222-222222222222', 'kid@test'),
  ('99999999-9999-9999-9999-999999999999', 'admin@test');
insert into admins (user_id) values ('99999999-9999-9999-9999-999999999999');

create function pg_temp.login(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true)
$$;
-- definer: looks families up past RLS, whoever is logged in
create function pg_temp.family(family_name text) returns uuid language sql security definer as $$
  select id from public.families where name = family_name
$$;

-- A request waits for approval and can't be used meanwhile
set local role authenticated;
select pg_temp.login('11111111-1111-1111-1111-111111111111');
select create_family('Garcia');
select is((select status from families), 'pending', 'a new family starts pending');
select is((select role from family_members), 'parent', 'requester sees their own membership while pending');
select throws_ok($$ insert into children (family_id, name) select id, 'Ana' from families $$,
  '42501', null, 'pending family cannot add children');
select throws_ok($$ select create_family('Garcia 2') $$, 'P0001', 'family request already pending',
  'only one pending request per user');
select throws_ok($$ update families set status = 'approved' $$, '42501', null, 'requester cannot approve via the API');
select throws_ok($$ select admin_set_family_status(pg_temp.family('Garcia'), 'approved') $$, 'P0001', 'admins only',
  'requester cannot call admin functions');
select throws_ok($$ select * from admin_families() $$, 'P0001', 'admins only', 'requester cannot list families');
select throws_ok($$ insert into admins (user_id) values (auth.uid()) $$, '42501', null, 'nobody can make themselves admin');
select is((select count(*)::int from admins), 0, 'admins table is invisible to the API');
select is(is_admin(), false, 'requester is not admin');

reset role;
select set_config('test.code', (select invite_code from families where name = 'Garcia'), true);
set local role authenticated;
select pg_temp.login('22222222-2222-2222-2222-222222222222');
select throws_ok(format('select join_family(%L)', current_setting('test.code')), 'P0001', 'invalid invite code',
  'nobody can join a pending family');

-- Admin decides
select pg_temp.login('99999999-9999-9999-9999-999999999999');
select is((select email from admin_families() where name = 'Garcia'), 'requester@test', 'admin sees who asks');
select admin_set_family_status(pg_temp.family('Garcia'), 'approved');
select is((select email from admin_families() where name = 'Garcia'), null, 'email is hidden once approved');
select create_family('Admins');
select is((select status from families where name = 'Admins'), 'approved', 'an admin''s own family is approved at once');

select pg_temp.login('11111111-1111-1111-1111-111111111111');
insert into children (family_id, name) select id, 'Ana' from families where name = 'Garcia';
insert into items (family_id, kind, name, points) select id, 'earn', 'Deberes', 10 from families where name = 'Garcia';
insert into transactions (family_id, child_id, item_id, points)
  select c.family_id, c.id, i.id, 0 from children c join items i using (family_id);
select is((select count(*)::int from children), 1, 'approved family works');

-- Rejection, and a new request replacing it
select create_family('Garcia bis');
select pg_temp.login('99999999-9999-9999-9999-999999999999');
select admin_set_family_status(pg_temp.family('Garcia bis'), 'rejected');
select pg_temp.login('11111111-1111-1111-1111-111111111111');
select is((select status from families where name = 'Garcia bis'), 'rejected', 'requester sees the rejection');
select create_family('Garcia tris');
select is((select array_agg(name order by name) from families where requested_by = auth.uid()),
  array['Garcia', 'Garcia tris'], 'a new request replaces the rejected one');

-- Deleting a whole family
select set_config('test.garcia', pg_temp.family('Garcia')::text, true);
select pg_temp.login('99999999-9999-9999-9999-999999999999');
select lives_ok(format('select admin_delete_family(%L)', current_setting('test.garcia')), 'admin deletes a family in use');
reset role;
select is((select count(*)::int from children where family_id::text = current_setting('test.garcia'))
          + (select count(*)::int from items where family_id::text = current_setting('test.garcia'))
          + (select count(*)::int from transactions where family_id::text = current_setting('test.garcia'))
          + (select count(*)::int from family_members where family_id::text = current_setting('test.garcia')),
  0, 'nothing of the deleted family is left');
select is((select count(*)::int from families where name in ('Admins', 'Garcia tris')), 2, 'other families are untouched');

select * from finish();
rollback;
