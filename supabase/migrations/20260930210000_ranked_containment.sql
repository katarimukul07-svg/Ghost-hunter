-- Retire the forgeable checkpoint POC. A client UI gate is not authorization:
-- valid JWT callers can invoke PostgREST RPCs directly without playing.
-- Keep definitions/data for historical evidence; no legacy score is eligible
-- for a future replay-backed leaderboard. Do not restore these grants.
revoke all on function
  public.start_ranked_run(text),
  public.checkpoint_ranked_round(uuid,integer),
  public.finish_ranked_run(uuid),
  public.start_ranked_run_v2(text,uuid),
  public.checkpoint_ranked_round_v2(uuid,integer,integer,uuid),
  public.finish_ranked_run_v2(uuid,integer),
  public.get_leaderboard(text,text,integer)
from public, anon, authenticated, service_role;

-- Also prevent a server accidentally treating these economic/ranked tables as
-- player-writable. Trusted server roles are outside the hostile client boundary.
revoke insert, update, delete on
  public.ranked_runs, public.ranked_events, public.wallet_ledger,
  public.entitlements, public.store_transactions
from public, anon, authenticated;

comment on table public.ranked_runs is
  'Retired checkpoint POC; counts do not prove gameplay and must never be imported as replay-verified scores.';
comment on function public.get_leaderboard(text,text,integer) is
  'Retired checkpoint-only leaderboard. Public and service-role execution revoked pending independent replay-backed replacement.';
