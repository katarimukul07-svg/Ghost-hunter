# Task 03 — server-verifiable gameplay replay POC

> The stored campaign report was refreshed after the ranked-containment conflict
> resolution repaired a coarse-grid reachability defect. The new grid costs more
> than the original PR #33 measurement; figures below describe the refreshed
> Linux campaign. Browser rows describe the original POC and require CI
> confirmation on subsequent commits. See [RANKED_CONTAINMENT.md](RANKED_CONTAINMENT.md).

## OBJECTIVE

**Question:** Can a verifier independently derive a score from bounded pointer
inputs using the real game's movement, shape collisions, prizes, exits, ghosts,
GC and bonus rules? Can it reject the checkpoint-only forgery established by
Task 01 without trusting client coordinates or round counters?

**Hypothesis:** Deterministic replay can prove consistency with the rules at
reasonable offline cost. It cannot establish that a human played, that a client
is unmodified, or that the reported logical time matches elapsed real time.

This is an architectural POC, not a production scoring service. Baseline:
`ad83cc8`, Task 02 merge #32. Branch: `feature/task03-ranked-gameplay-poc`.

## ARCHITECTURE RULES

An offline fixture registry issues a trusted challenge containing an opaque
crypto-generated run ID, fixture owner, crypto-generated seed (fixed explicitly
for reproducible tests), approved viewport profile, expiry and ruleset hash.
The ruleset hashes the actual trusted gameplay scripts and research probe.
Clients submit JSON with the run ID/ruleset, consecutive logical ticks, pointer
targets, lifecycle actions, and a claimed score/state digest. The verifier
validates binding and resource limits, initializes its own game state, advances
the real fixed-step update functions, and independently derives the score.
Client positions, speed, seed, delta time, currency and round writes are never
accepted as simulation inputs. The digest checks consistency; it is not a
signature, secret, attestation or security authority.

The `research/ranked-replay` adapter is injected by tests and excluded from the
normal `dist` build. The production changes are a separate gameplay random
stream and a deterministic Fisher–Yates bonus shuffle. Cosmetic draws still use
`Math.random`; they cannot advance the gameplay stream. The seeded PRNG is not
cryptographic and does not claim seed secrecy. Normal offline play seeds the
stream locally; no server challenge is connected to the released game.

The Node harness loads trusted repository scripts in their runtime order and
stubs DOM/audio/render effects. It preserves the real physics, collision,
fairness and bonus functions. Node `vm` is not a production security isolation
boundary. Untrusted JSON is never interpolated into executable source.
An asynchronous prize-reshuffle fallback throws in this harness rather than
inventing timer ordering; such runs are unsupported until deterministic events
are extracted. No alternative physics implementation was introduced.

## PROHIBITIONS

Keep public cloud/ranked activation disabled. Do not deploy the verifier, write
ranked scores, mint currency, activate purchases, add identity providers, bypass
branch protection or merge automatically. The existing SQL checkpoint protocol
still accepts fabricated sequential checkpoints. This POC does not repair that
live-path vulnerability or authorize activation.

## IMPLEMENTATION

- `src/game/random.js`: reproducible gameplay stream; independent from effects.
- `research/ranked-replay/probe.mjs`: test-only recording of pointer inputs and
  physical state; normal game bindings in Chromium and Node.
- `verifier.mjs`: wire-body cap before parsing (1,500,000 bytes), at most 18,000
  inputs, approved geometry, finite targets, consecutive tick sequence, legal
  pause/resume ordering, binding/expiry checks and a 3-second timeout for each
  trusted initialization/replay VM call.
- `player.mjs`: existing conservative route planner supplies inputs only. It
  never writes positions, rounds, grace or configuration.
- `campaign.mjs`: measured replay/forgery campaign and maximum-tick probe.
- In-memory receipt map models identical retries and conflicting repeats. It
  is ephemeral, single-process and not a persistent or concurrent score ledger.
- Offline cache version is bumped and includes the new random-stream script.

## TESTS

Reproduce:

```sh
npm ci --ignore-scripts
npm run validate
npm run test:backend
npx playwright test
npm run poc:replay
npm run test:security
```

The 15 new Node scenarios cover real input-only scores, phone/desktop state
matching, inflated score/empty-checkpoint attacks, injected positions/speed/
seed/delta/round/coins/grace, digest mismatch, missing/duplicate/reordered ticks,
truncation, owner/run/ruleset/expiry binding, malformed/excessive bodies,
idempotent/conflicting retries, pause/resume, natural bonus timer/spawn activity,
and invalid lifecycle transitions. A deliberately valid bot is accepted to
demonstrate the boundary of the claim.

Two Playwright executions use real canvas mouse controls at phone and desktop
viewport sizes. They record a prize pickup and exit, compare Chromium's physical
state with Node replay, exercise random-consuming cosmetic rendering, fabricate
a completion through the existing test hook, and alter movement speed. The
normal frame scheduler is stopped in this test so each recorded logical tick is
controlled. These are browser tests, not physical touch-device beta evidence or
proof that an authenticated user generated the input. Existing finger-drag and
100-round layout-generator tests still run separately.

## EVIDENCE

Recorded on 2026-09-30. Machine-readable snapshot:
[`reports/ranked-replay-poc.json`](../reports/ranked-replay-poc.json). CI regenerates
it and retains the report as `ranked-replay-poc`; browser tests attach synthetic
input traces to their test results. Timing varies by runner.

| Measurement | Result | Scope |
| --- | --- | --- |
| Rule-consistent input runs | 20/20 matching, zero false rejections in this corpus | 10 fixed seeds, 2 profiles, input-only bot |
| Inflated-score variants | 20/20 rejected | Original inputs with score increased by 100 |
| Browser-to-Node comparison | 2/2 passed | One completed round per viewport, canvas controls |
| Observed campaign scores | 1–7 completed rounds | Runs end on ghost collision; no 30-round survival claim |
| Replay latency | p50 339.54 ms, p95 705.08 ms | Linux x64 Node 24; short campaign cases only |
| Largest short-run wire body | 40,131 bytes | Uncompressed JSON |
| Maximum-tick probe | 18,000 ticks, score 2, 301.90 ms, 854,775 bytes | Reach two rounds, then remain in the safe exit for five simulation minutes |
| Peak process RSS | 241.98 MiB | Whole Node campaign, generation + replay + retained VM allocations; not per request |
| Node suite | 38 passed | 23 previous + 15 replay scenarios |
| Full browser suite on Mac | 49 passed, 1 existing platform-specific skip | Chromium desktop/mobile; no Android/iOS physical test claim |
| Security gate | 5 tests passed; no scanner findings | Synthetic input files; no secrets or live player accounts |

The maximum-tick case is a safe-exit workload, not five minutes of difficult
survival or a production throughput benchmark. Timed bonus spawn/expiry and
pause/resume are separately tested through normal inputs. This corpus does not
prove bonus collection, shield/slow effects, GC milestones, moving exits or
cross-engine replay match on long physical runs. Existing layout tests validate
reachability through round 100, not replay parity at those milestones.

The local Linux browser download was truncated, so browser evidence was gathered
on the user's Mac. Android/iOS compilation, database and exact-head required
checks are established by CI before handoff, not inferred from these local runs.

## ACCEPTANCE GATE

**Replay feasibility: PASS for the measured corpus.** Required: every known-valid
fixture matches, all defined inflated-score variants fail, browser traces match
Node, injected state/schema/binding violations fail, and the bounded probe
completes within its resource limit. This permits continued architecture work.

**Production ranked integrity: NOT PASSED.** Valid input automation passes. The
verifier does not establish human presence, wall-clock pacing, real hosted
identity, durable receipts, or public endpoint reliability. An attacker can
recompute a consistent digest; the derived score, not the digest, is authority.
Partial runs currently produce `replay_consistent`, not a completed ranked
receipt. Inputs after death can be no-ops. Pause/resume matches the current
game's grace reset; repeated valid pause cycles need a ranked-specific policy.
No real accounts, gateway calls or production leaderboard writes were used.

## DECISION / ARCHITECTURE IMPACT

**MODIFY.** Keep independent gameplay randomness and continue with bounded input
replay as a candidate score-validation architecture. Do not finalize a Node VM
service or enable public ranked play based on this POC.

Alternatives: sequential checkpoints are cheap but demonstrably forgeable;
client-signed snapshots cannot be trusted when signing authority is shipped to
the client; always-online authoritative simulation adds connectivity and
operating cost before that need is measured. Replay reuses working physics and
allows later verification, but requires pinned rules, bounded workloads,
version retention and reliable deterministic event ordering.

Risks: shared-runtime bugs, floating-point portability, timer fallback ordering,
viewport differences, predictable seed search, speed-up/offline input planning,
pause abuse, large telemetry, worker memory and unbounded replay retries.
Revisit the architecture if physical Safari/Android parity fails, legitimate
long runs exceed budgets, fallback ordering cannot be made deterministic, or
measured worker concurrency/cost favors a different execution model.

## NEXT PHASE

Task 04 must define and test ranked lifecycle/pacing and abuse policies, extract
a deterministic headless engine and fallback event queue, cover long input runs
through GC/exit/bonus milestones, and test Safari/Android/native traces. Then
measure isolated-worker concurrency/memory/cost and implement hosted authenticated
challenge issuance, durable idempotent receipts, expiry/forfeit/finish semantics,
quotas and quarantine. Old forgeable RPCs must lose any ranking authority before
activation. Test these gates in disposable staging before public leaderboard
or account rollout. Paid purchase verification remains a separate activation
gate. All work stays on branches with bot-authored PRs and owner approval.
