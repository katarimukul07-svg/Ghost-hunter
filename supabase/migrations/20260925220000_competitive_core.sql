-- Competitive backend foundation: ranked runs, public profiles, leaderboards,
-- server-owned economy, and purchase entitlement records.
-- Client code may call only explicitly granted RPCs. Economic tables have no
-- authenticated write grants.

create extension if not exists pgcrypto;

create table public.player_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Player' check (char_length(display_name) between 1 and 20),
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ranked_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','finished','rejected','abandoned')),
  started_at timestamptz not null default now(),
  last_checkpoint_at timestamptz not null default now(),
  finished_at timestamptz,
  verified_rounds integer not null default 0 check (verified_rounds between 0 and 1000000),
  client_build text not null check (char_length(client_build) between 1 and 80),
  rejection_reason text,
  constraint ranked_finished_consistency check (
    (status = 'finished' and finished_at is not null) or status <> 'finished'
  )
);
create index ranked_runs_user_finished_idx on public.ranked_runs(user_id, verified_rounds desc)
  where status = 'finished';
create index ranked_runs_started_idx on public.ranked_runs(started_at desc);

create table public.wallet_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  amount integer not null check (amount <> 0),
  reason text not null,
  reference_id text,
  created_at timestamptz not null default now(),
  unique(user_id, idempotency_key)
);

create table public.entitlements (
  user_id uuid not null references auth.users(id) on delete cascade,
  entitlement_key text not null,
  source text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key(user_id, entitlement_key)
);

create table public.store_transactions (
  provider text not null check (provider in ('apple','google')),
  transaction_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  status text not null check (status in ('verified','revoked','refunded')),
  verified_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(provider, transaction_id)
);

alter table public.player_profiles enable row level security;
alter table public.ranked_runs enable row level security;
alter table public.wallet_ledger enable row level security;
alter table public.entitlements enable row level security;
alter table public.store_transactions enable row level security;

revoke all on public.player_profiles, public.ranked_runs, public.wallet_ledger,
  public.entitlements, public.store_transactions from public, anon, authenticated;
grant select on public.player_profiles to authenticated;
grant select on public.ranked_runs to authenticated;
grant select on public.wallet_ledger to authenticated;
grant select on public.entitlements to authenticated;

create policy "Profiles readable by signed in players" on public.player_profiles
  for select to authenticated using (true);
create policy "Players read own runs" on public.ranked_runs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Players read own ledger" on public.wallet_ledger
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Players read own entitlements" on public.entitlements
  for select to authenticated using ((select auth.uid()) = user_id);

create function public.set_player_profile(new_display_name text, new_country_code text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare caller uuid := (select auth.uid());
begin
  if caller is null then raise exception 'Authentication required' using errcode='28000'; end if;
  new_display_name := btrim(new_display_name);
  new_country_code := nullif(upper(btrim(coalesce(new_country_code,''))), '');
  if char_length(new_display_name) < 1 or char_length(new_display_name) > 20
     or (new_country_code is not null and new_country_code !~ '^[A-Z]{2}$') then
    raise exception 'Invalid profile' using errcode='22023';
  end if;
  insert into public.player_profiles(user_id, display_name, country_code)
  values(caller, new_display_name, new_country_code)
  on conflict(user_id) do update set display_name=excluded.display_name,
    country_code=excluded.country_code, updated_at=now();
end $$;

create function public.start_ranked_run(new_client_build text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare caller uuid := (select auth.uid()); run_id uuid;
begin
  if caller is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if new_client_build is null or char_length(new_client_build) < 1 or char_length(new_client_build) > 80 then
    raise exception 'Invalid build' using errcode='22023';
  end if;
  update public.ranked_runs set status='abandoned'
    where user_id=caller and status='active' and started_at < now() - interval '2 hours';
  if exists(select 1 from public.ranked_runs where user_id=caller and status='active') then
    raise exception 'Active ranked run already exists' using errcode='55000';
  end if;
  insert into public.ranked_runs(user_id, client_build) values(caller,new_client_build)
    returning id into run_id;
  return run_id;
end $$;

create function public.checkpoint_ranked_round(run_id uuid, completed_round integer)
returns integer language plpgsql security definer set search_path = ''
as $$
declare caller uuid := (select auth.uid()); current_round integer; last_at timestamptz; started timestamptz;
begin
  if caller is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select verified_rounds,last_checkpoint_at,started_at into current_round,last_at,started
    from public.ranked_runs where id=run_id and user_id=caller and status='active' for update;
  if not found then raise exception 'Ranked run unavailable' using errcode='22023'; end if;
  if completed_round <> current_round + 1 then
    update public.ranked_runs set status='rejected', rejection_reason='non_sequential_round' where id=run_id;
    raise exception 'Invalid round sequence' using errcode='22023';
  end if;
  -- Conservative anti-automation floor. This is not the only anti-cheat signal;
  -- suspicious high scores remain reviewable and the server owns acceptance.
  if now() - last_at < interval '0.35 seconds' or now() - started > interval '2 hours' then
    update public.ranked_runs set status='rejected', rejection_reason='timing_violation' where id=run_id;
    raise exception 'Invalid round timing' using errcode='22023';
  end if;
  update public.ranked_runs set verified_rounds=completed_round,last_checkpoint_at=now() where id=run_id;
  return completed_round;
end $$;

create function public.finish_ranked_run(run_id uuid)
returns integer language plpgsql security definer set search_path = ''
as $$
declare caller uuid := (select auth.uid()); score integer;
begin
  if caller is null then raise exception 'Authentication required' using errcode='28000'; end if;
  update public.ranked_runs set status='finished',finished_at=now()
    where id=run_id and user_id=caller and status='active'
    returning verified_rounds into score;
  if score is null then raise exception 'Ranked run unavailable' using errcode='22023'; end if;
  return score;
end $$;

create function public.get_leaderboard(board text default 'world', board_country text default null, result_limit integer default 100)
returns table(rank bigint, display_name text, country_code text, score integer, achieved_at timestamptz)
language sql security definer set search_path = ''
as $$
  with best as (
    select r.user_id, max(r.verified_rounds)::integer score, min(r.finished_at) achieved_at
    from public.ranked_runs r
    where r.status='finished'
      and case board
        when 'daily' then r.finished_at >= date_trunc('day', now())
        when 'weekly' then r.finished_at >= date_trunc('week', now())
        when 'seasonal' then r.finished_at >= date_trunc('month', now())
        else true
      end
    group by r.user_id
  ), filtered as (
    select b.*, coalesce(p.display_name,'Player') display_name, p.country_code
    from best b left join public.player_profiles p on p.user_id=b.user_id
    where board <> 'country' or p.country_code=upper(board_country)
  )
  select row_number() over(order by score desc, achieved_at asc), display_name, country_code, score, achieved_at
  from filtered order by score desc, achieved_at asc limit least(greatest(result_limit,1),100);
$$;

revoke all on function public.set_player_profile(text,text),
  public.start_ranked_run(text), public.checkpoint_ranked_round(uuid,integer),
  public.finish_ranked_run(uuid), public.get_leaderboard(text,text,integer) from public, anon;
grant execute on function public.set_player_profile(text,text),
  public.start_ranked_run(text), public.checkpoint_ranked_round(uuid,integer),
  public.finish_ranked_run(uuid), public.get_leaderboard(text,text,integer) to authenticated;

-- Economic mutation is intentionally absent from the public API. Purchase
-- verification functions/Edge Functions must use trusted store APIs and the
-- service role, then write idempotently to store_transactions/ledger/entitlements.
