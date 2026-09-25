begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;
select plan(13);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at)
values
 ('20000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rank-a@example.invalid','',now()),
 ('20000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rank-b@example.invalid','',now());

select ok((select relrowsecurity from pg_class where oid='public.ranked_runs'::regclass),'ranked runs use RLS');
select ok(not has_table_privilege('authenticated','public.ranked_runs','INSERT'),'client cannot insert ranked scores');
select ok(not has_table_privilege('authenticated','public.wallet_ledger','INSERT'),'client cannot mint currency');
select ok(not has_table_privilege('authenticated','public.entitlements','INSERT'),'client cannot grant entitlements');
select ok(not has_table_privilege('authenticated','public.store_transactions','SELECT'),'store evidence is not client-readable');

set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.set_player_profile('Pilot A','us')$$,'player can set allowlisted profile');
create temporary table test_run(id uuid);
insert into test_run select public.start_ranked_run('test-build');
select results_eq($$select count(*) from public.ranked_runs$$,array[1::bigint],'player sees own active run');
select throws_ok($$select public.start_ranked_run('test-build')$$,'55000','Active ranked run already exists','duplicate active run blocked');

reset role;
update public.ranked_runs set last_checkpoint_at=now()-interval '1 second'
where user_id='20000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
select results_eq(
 $$select public.checkpoint_ranked_round((select id from test_run),1)$$,
 array[1::integer],'sequential checkpoint accepted');

reset role;
update public.ranked_runs set last_checkpoint_at=now()-interval '1 second'
where user_id='20000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
select throws_ok(
 $$select public.checkpoint_ranked_round((select id from test_run),3)$$,
 '22023','Invalid round sequence','skipped round rejected');

-- Rejection is transactional with the raised exception, so explicitly abandon
-- the test run before creating a clean finished score.
reset role;
update public.ranked_runs set status='abandoned'
where user_id='20000000-0000-4000-8000-000000000001' and status='active';
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
truncate test_run;
insert into test_run select public.start_ranked_run('test-build-2');
reset role;
update public.ranked_runs set verified_rounds=7,last_checkpoint_at=now()-interval '1 second'
where id=(select id from test_run);
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
select results_eq($$select public.finish_ranked_run((select id from test_run))$$,array[7::integer],'finish uses server checkpoint score');
select results_eq(
 $$select score from public.get_leaderboard('world',null,100) limit 1$$,
 array[7::integer],'leaderboard reads verified finished score');

select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
select results_eq($$select count(*) from public.ranked_runs$$,array[0::bigint],'other player cannot read A run');

select * from finish();
rollback;
