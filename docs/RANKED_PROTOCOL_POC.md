# Ranked protocol reliability POC

> **Current status (2026-09-30):** The checkpoint protocol is retired by
> `20260930210000_ranked_containment.sql`. All seven legacy/ranked/leaderboard
> RPCs deny `anon`, `authenticated`, and `service_role`. Cloud account activation
> cannot enable ranked play. The protocol and evidence below are historical;
> a replay validator must use a separate verified-score store. See
> [RANKED_CONTAINMENT.md](RANKED_CONTAINMENT.md). This is repository state;
> deployment to a hosted database must be verified separately.


## Question and hypothesis
Can a serial, idempotent protocol preserve an acknowledged ranked score through duplicate, reordered, and lost requests without pausing gameplay? We expected yes for network faults, while sequential RPCs alone would remain forgeable by a scripted client.

## Previous behavior
Gameplay invoked start, checkpoint, and finish without waiting for prior calls. A missing start response could cause lost checkpoints; finish could overtake the last checkpoint. The old SQL marked invalid runs rejected and then raised an exception, rolling the rejection back. The old database test manually abandoned that run. The old functions have been revoked from authenticated clients by the new migration.

## POC architecture
`game → in-memory ordered queue → keyed start acknowledgement → checkpoint(sequence, round, event_id) → locked server transaction → accepted / duplicate / expected_sequence / rejected → finish(expected_rounds)`.

The server creates the run ID. A stable client-generated start key identifies a retry. Every logical checkpoint retains the same event ID on retry. A per-run row lock serializes checkpoint and finish transactions. Identical repeats return the current state; a missing sequence returns the expected sequence without rejecting a legitimate player. An invalid round/sequence pair or conflicting event permanently rejects the run by returning a committed result, rather than raising after the update. Finish returns `expected_sequence` until the requested number of checkpoints has committed; a repeated finish returns the same score. The client never waits in the game frame loop.

A run is held in memory. Reload/crash forfeits its unsent events; the existing active server run may block a new run until it expires after two hours. No local persistence or recovery is implied. A quick replay waits for the previous finish promise before starting another run. Authentication sign-out cancels the client queue. Competitive activation still requires `ECHO_CLOUD_ACTIVATE=1`; the normal build produces `enabled:false`.

## Test matrix and measurements
The automated client tests cover 30 queued rounds; a lost request; a lost response followed by idempotent retry; latency; delayed checkpoint before finish; server rejection; and reload/cancellation. SQL pgTAP covers RLS/grants, keyed start, sequence gaps, duplicate checkpoints, premature finish, duplicate finish, durable rejection and subsequent blocking, other-user access, and a scripted client submitting checkpoints without gameplay. The database transaction uses `FOR UPDATE`; true concurrent database transactions still require an integration test against a running Postgres instance. Background/resume is represented by a pending checkpoint that resumes, not a real mobile lifecycle test.

Measured on this executor with an **in-process fake RPC** and real injected waits; these are not database or internet latency measurements:

| Injected wait per mutation | Completed / attempted | Score | p50 | p95 | Retries | Incorrect scores | Legitimate rejections |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 50 ms | 1/1 | 5 | 50.7 ms | 51.0 ms | 0 | 0 | 0 |
| 200 ms | 1/1 | 5 | 199.6 ms | 201.0 ms | 0 | 0 | 0 |
| 500 ms | 1/1 | 5 | 500.1 ms | 500.6 ms | 0 | 0 | 0 |
| 1500 ms | 1/1 | 5 | 1500.0 ms | 1500.8 ms | 0 | 0 | 0 |

The fault-injection tests recovered from one lost request and one lost response each, with zero incorrect scores. A dropped response retries the same event ID, so the fake server acknowledges it as a duplicate. More extensive distributions, concurrent database timings, and real radio interruptions remain unmeasured.

## Security finding
The pgTAP scripted client directly calls start, checkpoint 1, checkpoint 2, and finish without playing. The RPC accepts the run, demonstrating that sequence/order checks do **not** prove real gameplay. This is expected and blocks production ranked activation. The migration does not accept an arbitrary final score and preserves RLS and server-controlled progression.

## Decision and architecture impact
**MODIFY.** Keep the ordered protocol and durable rejection design for further testing, but do not enable ranked production play. Task 03 should gather server-verifiable gameplay telemetry and test scripted evasion; Task 04 should evaluate anti-cheat signals and abuse operations against measured attacks. Prior to activation, run real Postgres concurrent RPC tests and device background/reload tests, design durable recovery or explicit forfeiture, establish an operational retry ceiling, and test credential expiry and server downtime.

## Verification and remaining risks
Static validation, backend tests, and web build passed locally. The local browser suite could not start because Chromium was not installed and the browser download endpoint returned a truncated archive. This Linux executor has no Docker/Supabase CLI, Android SDK, or Xcode, so database, browser, Android, and iOS results must be taken from CI. PR #30 was opened, but its initial GitHub workflow returned `action_required` before creating any jobs; the owner must approve running the workflow before CI results can be recorded. The scripted score forgery is a known architectural vulnerability, and no claim of production anti-cheat protection is made.
