begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;
select plan(15);

-- Disposable Auth fixtures. This transaction rolls them back after the tests.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'save-a-test@example.invalid', '', now()),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'save-b-test@example.invalid', '', now());

select ok((select relrowsecurity from pg_class where oid = 'public.player_saves'::regclass),
  'row-level security is enabled');
select ok(not has_table_privilege('authenticated', 'public.player_saves', 'UPDATE'),
  'players cannot directly change a stored save');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select results_eq(
  $$select public.put_player_save(0, '{}'::jsonb, 3)$$,
  array[1::bigint], 'A creates revision 1');
select results_eq(
  $$select count(*) from public.player_saves$$,
  array[1::bigint], 'A sees one save');
select results_eq(
  $$select public.put_player_save(1, '{}'::jsonb, 2)$$,
  array[2::bigint], 'A advances the revision');
select results_eq(
  $$select best_rounds from public.player_saves$$,
  array[3::integer], 'personal best never decreases');
select throws_ok(
  $$update public.player_saves set best_rounds = 99$$,
  '42501', null, 'A cannot bypass the revision RPC with a direct update');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select results_eq(
  $$select count(*) from public.player_saves$$,
  array[0::bigint], 'B cannot see A');
select throws_ok(
  $$delete from public.player_saves$$,
  '42501', null, 'B cannot directly delete saves');
select results_eq(
  $$select public.put_player_save(0, '{}'::jsonb, 1)$$,
  array[1::bigint], 'B creates an independent save');
select results_eq(
  $$select count(*) from public.player_saves$$,
  array[1::bigint], 'B sees only B');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select public.put_player_save(0, '{}'::jsonb, 10)$$,
  '40001', 'Save revision conflict', 'A cannot overwrite a newer revision');
select throws_ok(
  $$select public.put_player_save(2, '{"coins":999}'::jsonb, 10)$$,
  '22023', 'Invalid save', 'client-authored currency is rejected');
select throws_ok(
  $$select public.put_player_save(2, jsonb_build_object('name', repeat('x', 5000)), 10)$$,
  '22023', 'Invalid save', 'oversized save is rejected');

set local role anon;
select throws_ok(
  $$select public.put_player_save(0, '{}'::jsonb, 1)$$,
  '42501', null, 'anonymous calls cannot write saves');

select * from finish();
rollback;
