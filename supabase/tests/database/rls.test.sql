begin;
select plan(9);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'parent@test'),
  ('22222222-2222-2222-2222-222222222222', 'kid@test'),
  ('33333333-3333-3333-3333-333333333333', 'outsider@test');

-- Parent sets up the family
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select isnt(create_family('Dojo'), null, 'parent creates a family');
insert into children (family_id, name) select id, 'Ana' from families;
insert into items (family_id, kind, name, points) select id, 'earn', 'Deberes', 10 from families;

reset role;
select set_config('test.code', (select invite_code from families where name = 'Dojo'), true);

-- Kid joins with the invite code
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select join_family(current_setting('test.code'));
select is((select role from family_members where user_id = auth.uid()), 'child', 'invite code joins as child');

insert into transactions (family_id, child_id, item_id, points)
  select c.family_id, c.id, i.id, 1000 from children c, items i;
select is((select points from transactions), 10, 'points come from the item, not the client');

select throws_ok(
  $$ insert into transactions (family_id, child_id, item_id, points, status)
       select c.family_id, c.id, i.id, 0, 'approved' from children c, items i $$,
  '42501', null, 'kid cannot insert an approved transaction');

update transactions set status = 'approved';
select is((select status from transactions), 'pending', 'kid cannot approve');

select throws_ok(
  $$ insert into children (family_id, name) select id, 'X' from families $$,
  '42501', null, 'kid cannot add children');

-- Parent approves
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
update transactions set status = 'approved';
select is((select points from child_balances), 10, 'approved points count in the balance');

-- Another family sees nothing
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is((select count(*) from children)::int, 0, 'outsider sees no children');
select throws_ok($$ select join_family('nope') $$, 'P0001', 'invalid invite code', 'bad invite code is rejected');

select * from finish();
rollback;
