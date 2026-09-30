-- Leaderboards already expose only rank/name/country/score/time. Direct profile
-- reads need only the caller's record; do not enumerate internal Auth UUIDs.
drop policy "Profiles readable by signed in players" on public.player_profiles;
create policy "Players read own profile" on public.player_profiles
  for select to authenticated using ((select auth.uid()) = user_id);
