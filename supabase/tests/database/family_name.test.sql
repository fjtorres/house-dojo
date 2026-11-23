begin;
select plan(3);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'parent@test');
create function pg_temp.login(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true)
$$;

set local role authenticated;
select pg_temp.login('11111111-1111-1111-1111-111111111111');
select throws_ok($$ select create_family(repeat('a', 41)) $$, '23514', null, 'a family name over 40 characters is rejected');
select lives_ok($$ select create_family(repeat('ñ', 40)) $$, '40 characters fit, counting characters, not bytes');

reset role;
select throws_ok($$ update families set name = repeat('b', 41) where name = repeat('ñ', 40) $$, '23514', null,
  'renaming checks the length too');

select * from finish();
rollback;
