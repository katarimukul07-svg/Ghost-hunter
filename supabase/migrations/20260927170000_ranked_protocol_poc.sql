-- Protocol v2: durable outcomes, keyed starts, ordered idempotent checkpoints.
-- The original RPCs remain defined for migration history, but are no longer callable.
revoke execute on function public.start_ranked_run(text), public.checkpoint_ranked_round(uuid,integer),
  public.finish_ranked_run(uuid) from authenticated;

alter table public.ranked_runs add column start_key uuid;
create unique index ranked_start_key_unique on public.ranked_runs(user_id,start_key);
create unique index ranked_one_active_per_user on public.ranked_runs(user_id) where status='active';

create table public.ranked_events (
  run_id uuid not null references public.ranked_runs(id) on delete cascade,
  sequence integer not null check (sequence > 0),
  event_id uuid not null,
  received_at timestamptz not null default now(),
  primary key(run_id,sequence),
  unique(run_id,event_id)
);
alter table public.ranked_events enable row level security;
revoke all on public.ranked_events from public,anon,authenticated;

create function public.start_ranked_run_v2(new_client_build text, new_start_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare caller uuid := (select auth.uid()); r public.ranked_runs%rowtype;
begin
  if caller is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if new_start_key is null or new_client_build is null or char_length(new_client_build) not between 1 and 80 then
    raise exception 'Invalid start' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(caller::text, 0));
  select * into r from public.ranked_runs where user_id=caller and start_key=new_start_key;
  if found then return jsonb_build_object('status',r.status,'run_id',r.id,'verified_rounds',r.verified_rounds); end if;
  update public.ranked_runs set status='abandoned' where user_id=caller and status='active'
    and started_at < now()-interval '2 hours';
  select * into r from public.ranked_runs where user_id=caller and status='active';
  if found then return jsonb_build_object('status','active_conflict','run_id',r.id); end if;
  insert into public.ranked_runs(user_id,client_build,start_key) values(caller,new_client_build,new_start_key)
    returning * into r;
  return jsonb_build_object('status','active','run_id',r.id,'verified_rounds',0);
end $$;

create function public.checkpoint_ranked_round_v2(run_id uuid, sequence integer, completed_round integer, event_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare caller uuid := (select auth.uid()); r public.ranked_runs%rowtype; existing uuid;
begin
  if caller is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select * into r from public.ranked_runs where id=run_id and user_id=caller for update;
  if not found then return jsonb_build_object('status','unavailable'); end if;
  if r.status <> 'active' then return jsonb_build_object('status',r.status,'verified_rounds',r.verified_rounds); end if;
  if sequence is null or completed_round is null or event_id is null or sequence < 1
    or completed_round < 1 or completed_round > 1000000 or sequence <> completed_round then
    update public.ranked_runs set status='rejected',rejection_reason='invalid_progression' where id=run_id;
    return jsonb_build_object('status','rejected','reason','invalid_progression');
  end if;
  select e.event_id into existing from public.ranked_events e where e.run_id=run_id and e.sequence=sequence;
  if found then
    if existing=event_id then
      return jsonb_build_object('status','duplicate','verified_rounds',r.verified_rounds,'expected_sequence',r.verified_rounds+1);
    end if;
    update public.ranked_runs set status='rejected',rejection_reason='conflicting_event' where id=run_id;
    return jsonb_build_object('status','rejected','reason','conflicting_event');
  end if;
  if exists(select 1 from public.ranked_events e where e.run_id=run_id and e.event_id=checkpoint_ranked_round_v2.event_id) then
    update public.ranked_runs set status='rejected',rejection_reason='reused_event_id' where id=run_id;
    return jsonb_build_object('status','rejected','reason','reused_event_id');
  end if;
  if sequence <> r.verified_rounds+1 then
    return jsonb_build_object('status','expected_sequence','expected_sequence',r.verified_rounds+1,'verified_rounds',r.verified_rounds);
  end if;
  if now()-r.started_at > interval '2 hours' then
    update public.ranked_runs set status='rejected',rejection_reason='expired' where id=run_id;
    return jsonb_build_object('status','rejected','reason','expired');
  end if;
  insert into public.ranked_events(run_id,sequence,event_id) values(run_id,sequence,event_id);
  update public.ranked_runs set verified_rounds=completed_round,last_checkpoint_at=now() where id=run_id;
  return jsonb_build_object('status','accepted','verified_rounds',completed_round,'expected_sequence',completed_round+1);
end $$;

create function public.finish_ranked_run_v2(run_id uuid, expected_rounds integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare caller uuid := (select auth.uid()); r public.ranked_runs%rowtype;
begin
  if caller is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select * into r from public.ranked_runs where id=run_id and user_id=caller for update;
  if not found then return jsonb_build_object('status','unavailable'); end if;
  if r.status='finished' then return jsonb_build_object('status','finished','score',r.verified_rounds); end if;
  if r.status <> 'active' then return jsonb_build_object('status',r.status); end if;
  if expected_rounds is null or expected_rounds < 0 or expected_rounds > 1000000 then
    return jsonb_build_object('status','invalid_finish');
  end if;
  if expected_rounds <> r.verified_rounds then
    return jsonb_build_object('status','expected_sequence','expected_sequence',r.verified_rounds+1);
  end if;
  update public.ranked_runs set status='finished',finished_at=now() where id=run_id;
  return jsonb_build_object('status','finished','score',r.verified_rounds);
end $$;

revoke all on function public.start_ranked_run_v2(text,uuid),
  public.checkpoint_ranked_round_v2(uuid,integer,integer,uuid),public.finish_ranked_run_v2(uuid,integer) from public,anon;
grant execute on function public.start_ranked_run_v2(text,uuid),
  public.checkpoint_ranked_round_v2(uuid,integer,integer,uuid),public.finish_ranked_run_v2(uuid,integer) to authenticated;
