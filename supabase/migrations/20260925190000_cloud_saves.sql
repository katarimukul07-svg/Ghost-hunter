-- Foundation only. No client integration, currency, purchases, or production data yet.
-- Apply with the Supabase migration runner, which provides auth.uid().
create table public.player_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  schema_version integer not null default 1 check (schema_version = 1),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  best_rounds integer not null default 0 check (best_rounds between 0 and 1000000),
  updated_at timestamptz not null default now(),
  constraint settings_size check (octet_length(settings::text) <= 4096)
);

alter table public.player_saves enable row level security;
revoke all on public.player_saves from public, anon, authenticated;
grant select on public.player_saves to authenticated;

create policy "Read own save" on public.player_saves
  for select to authenticated using ((select auth.uid()) = user_id);

-- Settings are explicitly allowlisted. Do not place coins, entitlements, secrets,
-- email, or other sensitive records in this client-authored JSON document.
create function public.put_player_save(
  expected_revision bigint,
  new_settings jsonb,
  new_best_rounds integer
) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  next_revision bigint;
begin
  if caller is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if expected_revision < 0 or expected_revision is null
    or new_settings is null or jsonb_typeof(new_settings) <> 'object'
    or octet_length(new_settings::text) > 4096
    or new_best_rounds is null or new_best_rounds < 0 or new_best_rounds > 1000000
    or exists (
      select 1 from jsonb_object_keys(new_settings) as key
      where key not in ('name', 'color', 'trail', 'ghostSkin', 'deathfx', 'sound', 'mute', 'background', 'hint')
    )
  then
    raise exception 'Invalid save' using errcode = '22023';
  end if;

  insert into public.player_saves (user_id, revision, settings, best_rounds)
  select caller, 1, new_settings, new_best_rounds
  where expected_revision = 0
    or exists (select 1 from public.player_saves where user_id = caller)
  on conflict (user_id) do update
    set revision = public.player_saves.revision + 1,
        settings = excluded.settings,
        best_rounds = greatest(public.player_saves.best_rounds, excluded.best_rounds),
        updated_at = now()
    where public.player_saves.revision = expected_revision
  returning revision into next_revision;

  if next_revision is null then
    raise exception 'Save revision conflict' using errcode = '40001';
  end if;
  return next_revision;
end;
$$;

revoke all on function public.put_player_save(bigint, jsonb, integer) from public, anon;
grant execute on function public.put_player_save(bigint, jsonb, integer) to authenticated;
