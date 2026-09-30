-- New replay namespace. Never import checkpoint-only historical scores.
create table public.ranked_rulesets (
 id text primary key check (id ~ '^[0-9a-f]{64}$'),
 enabled boolean not null default false,
 created_at timestamptz not null default clock_timestamp()
);
create table public.ranked_replay_runs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 start_key uuid not null,
 finish_key uuid,
 ruleset text not null references public.ranked_rulesets(id),
 profile text not null check (profile in ('phone','desktop')),
 key_id text not null check (key_id ~ '^[a-zA-Z0-9_-]{1,40}$'),
 nonce text not null default encode(gen_random_bytes(32),'hex'),
 seed bigint not null default ('x'||encode(gen_random_bytes(4),'hex'))::bit(32)::bigint check (seed between 0 and 4294967295),
 status text not null default 'started' check (status in ('started','processing','accepted','rejected')),
 started_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null,
 finished_at timestamptz,
 duration_ms bigint generated always as (floor(extract(epoch from (finished_at-started_at))*1000)::bigint) stored,
 simulated_ms bigint,
 score integer check (score between 0 and 1000000),
 reason text,
 lease_nonce uuid,
 lease_version integer not null default 0,
 lease_until timestamptz,
 attempts integer not null default 0 check (attempts between 0 and 3),
 unique(user_id,start_key), unique(user_id,finish_key),
 check (expires_at>started_at),
 check (finished_at is null or (finished_at>=started_at and finished_at<=expires_at)),
 check (status='started' or finished_at is not null),
 check (status<>'accepted' or (score is not null and simulated_ms is not null and duration_ms>=simulated_ms))
);
create unique index one_open_replay_per_player on public.ranked_replay_runs(user_id) where status in ('started','processing');
create index replay_queue on public.ranked_replay_runs(finished_at) where status='processing';
create table public.ranked_telemetry (
 run_id uuid primary key references public.ranked_replay_runs(id) on delete cascade,
 inputs jsonb not null check (jsonb_typeof(inputs)='array' and jsonb_array_length(inputs) between 1 and 18000),
 payload_digest text not null check (payload_digest ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default clock_timestamp(),
 check (octet_length(inputs::text)<=1500000)
);
alter table public.ranked_rulesets enable row level security;
alter table public.ranked_replay_runs enable row level security;
alter table public.ranked_telemetry enable row level security;
revoke all on public.ranked_rulesets,public.ranked_replay_runs,public.ranked_telemetry from public,anon,authenticated,service_role;
grant select(id,status,started_at,finished_at,duration_ms,score,reason) on public.ranked_replay_runs to authenticated;
create policy own_replay_summary on public.ranked_replay_runs for select to authenticated using (user_id=(select auth.uid()));

-- Only the verified Edge service can mint runs. Timestamp/nonce/seed come from
-- Postgres, never from caller telemetry or a device clock.
create function public.issue_replay_run(actor uuid, request_key uuid, engine text, viewport text, signing_key_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.ranked_replay_runs; t timestamptz:=clock_timestamp();
begin
 if actor is null or request_key is null then raise exception 'Invalid request' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
 select * into r from public.ranked_replay_runs where user_id=actor and start_key=request_key;
 if found then
  if r.ruleset<>engine or r.profile<>viewport then raise exception 'Idempotency conflict' using errcode='40001'; end if;
  return to_jsonb(r);
 end if;
 if not exists(select 1 from public.ranked_rulesets where id=engine and enabled) then raise exception 'Ranked unavailable' using errcode='55000'; end if;
 update public.ranked_replay_runs set status='rejected',reason='expired',finished_at=expires_at
 where user_id=actor and status='started' and expires_at<=t;
 if exists(select 1 from public.ranked_replay_runs where user_id=actor and status in ('started','processing')) then raise exception 'Run already open' using errcode='55000'; end if;
 if (select count(*) from public.ranked_replay_runs where user_id=actor and started_at>t-interval '1 hour')>=30 then raise exception 'Run quota exceeded' using errcode='54000'; end if;
 if (select count(*) from public.ranked_replay_runs where status='processing')>=100 then raise exception 'Replay queue full' using errcode='54000'; end if;
 insert into public.ranked_replay_runs(user_id,start_key,ruleset,profile,key_id,started_at,expires_at)
 values(actor,request_key,engine,viewport,signing_key_id,t,t+interval '30 minutes') returning * into r;
 return to_jsonb(r);
end $$;

-- Finish receipt and immutable telemetry commit together, before replay begins.
create function public.submit_replay_run(actor uuid, run uuid, request_key uuid, input_log jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.ranked_replay_runs; d text; steps bigint; t timestamptz:=clock_timestamp();
begin
 if actor is null or request_key is null or jsonb_typeof(input_log)<>'array' or jsonb_array_length(input_log) not between 1 and 18000 or octet_length(input_log::text)>1500000 then raise exception 'Invalid telemetry' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('ghost-hunter-replay-queue',0));
 select * into r from public.ranked_replay_runs where id=run and user_id=actor for update;
 if not found then raise exception 'Run unavailable' using errcode='42501'; end if;
 d:=encode(extensions.digest(convert_to(input_log::text,'UTF8'),'sha256'),'hex');
 if r.status<>'started' then
  if r.finish_key=request_key and exists(select 1 from public.ranked_telemetry where run_id=run and payload_digest=d) then return jsonb_build_object('run_id',r.id,'status',r.status); end if;
  raise exception 'Idempotency conflict' using errcode='40001';
 end if;
 if (select count(*) from public.ranked_replay_runs where status='processing')>=100 then raise exception 'Replay queue full' using errcode='54000'; end if;
 if t>r.expires_at then raise exception 'Ticket expired' using errcode='22023'; end if;
 -- DB independently counts actual simulation steps, even if ingress is buggy.
 select count(*) into steps from jsonb_array_elements(input_log) x where x->>'action'='step';
 if steps=0 then raise exception 'No simulation steps' using errcode='22023'; end if;
 if floor(extract(epoch from(t-r.started_at))*1000)<ceil(steps*1000.0/60) then raise exception 'Impossible duration' using errcode='22023'; end if;
 insert into public.ranked_telemetry(run_id,inputs,payload_digest) values(run,input_log,d);
 update public.ranked_replay_runs set status='processing',finish_key=request_key,finished_at=t,simulated_ms=ceil(steps*1000.0/60) where id=run;
 return jsonb_build_object('run_id',run,'status','processing');
end $$;

-- Lease fencing prevents a crashed or slow worker committing after another
-- worker has reclaimed the job. No client role can call worker functions.
create function public.claim_replay_run() returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.ranked_replay_runs;
begin
 update public.ranked_replay_runs set status='rejected',reason='worker_retry_exhausted'
 where status='processing' and attempts=3 and lease_until<clock_timestamp();
 select * into r from public.ranked_replay_runs where status='processing' and attempts<3
 and (lease_until is null or lease_until<clock_timestamp()) order by finished_at for update skip locked limit 1;
 if not found then return null; end if;
 update public.ranked_replay_runs set lease_nonce=gen_random_uuid(),lease_version=lease_version+1,
 lease_until=clock_timestamp()+interval '30 seconds',attempts=attempts+1 where id=r.id returning * into r;
 return to_jsonb(r)||jsonb_build_object('inputs',(select inputs from public.ranked_telemetry where run_id=r.id));
end $$;
create function public.complete_replay_run(run uuid, lease uuid, version integer, computed_score integer, rejection text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare r public.ranked_replay_runs;
begin
 select * into r from public.ranked_replay_runs where id=run for update;
 if not found or r.lease_nonce is distinct from lease or r.lease_version<>version then return false; end if;
 if r.status in ('accepted','rejected') then return r.score is not distinct from computed_score and r.reason is not distinct from rejection; end if;
 if r.status<>'processing' or r.lease_until<=clock_timestamp() then return false; end if;
 if rejection is not null and rejection not in ('invalid_input','simulation_failed','ruleset_unavailable','resource_limit') then raise exception 'Invalid rejection' using errcode='22023'; end if;
 if rejection is null and (computed_score is null or computed_score not between 0 and 1000000) then raise exception 'Invalid score' using errcode='22023'; end if;
 if rejection is not null and computed_score is not null then raise exception 'Rejected score' using errcode='22023'; end if;
 update public.ranked_replay_runs set status=case when rejection is null then 'accepted' else 'rejected' end,
 score=computed_score,reason=rejection where id=run;
 return true;
end $$;
-- Ticket verification checks the persisted binding before telemetry is accepted.
create function public.read_replay_run(actor uuid, run uuid) returns jsonb language sql security definer set search_path='' as $$
 select to_jsonb(r) from public.ranked_replay_runs r where id=run and user_id=actor;
$$;
revoke all on function public.issue_replay_run(uuid,uuid,text,text,text),public.submit_replay_run(uuid,uuid,uuid,jsonb),public.claim_replay_run(),public.complete_replay_run(uuid,uuid,integer,integer,text),public.read_replay_run(uuid,uuid) from public,anon,authenticated;
grant execute on function public.issue_replay_run(uuid,uuid,text,text,text),public.submit_replay_run(uuid,uuid,uuid,jsonb),public.claim_replay_run(),public.complete_replay_run(uuid,uuid,integer,integer,text),public.read_replay_run(uuid,uuid) to service_role;
-- Activation remains closed until hosted, concurrent and native replay gates pass.
insert into public.ranked_rulesets(id,enabled) values('20da1845f2ea33f5c8659ec1f955a715393191228a9ac44c1dea7cc76611fcdd',false);

create function public.get_replay_leaderboard(result_limit integer default 50)
returns table(rank bigint,display_name text,country_code text,score integer,achieved_at timestamptz)
language sql security definer set search_path='' as $$
 with best as (
  select distinct on (r.user_id) r.user_id,r.score,r.finished_at,r.id
  from public.ranked_replay_runs r join public.ranked_rulesets e on e.id=r.ruleset and e.enabled
  where r.status='accepted' order by r.user_id,r.score desc,r.finished_at,r.id
 )
 select row_number() over(order by b.score desc,b.finished_at,b.id),coalesce(p.display_name,'Player'),p.country_code,b.score,b.finished_at
 from best b left join public.player_profiles p on p.user_id=b.user_id
 order by b.score desc,b.finished_at,b.id limit greatest(1,least(coalesce(result_limit,50),100));
$$;
revoke all on function public.get_replay_leaderboard(integer) from public,anon;
grant execute on function public.get_replay_leaderboard(integer) to authenticated;
