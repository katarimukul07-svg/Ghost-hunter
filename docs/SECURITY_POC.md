# Task 02 — security baseline and attack-surface POC

## 1. Question

Can anonymous clients or ordinary players bypass the UI to read or mutate private data, mint economic value, delete another account, persist credentials, or inject executable display text? Can the build and CI detect meaningful regressions without claiming to prove security? This POC does not establish fair gameplay or authorize production ranked activation.

## 2. Scope

Baseline: fetched `origin/main`, `01a31e2` (Task 01 merge #30), 2026-09-27. The user's original checkout had untracked `backups/`, `data/`, `supabase/.temp/`; preserved without reading unrelated databases. Work uses a clean separate worktree and `feature/task02-security-baseline-poc`. Reviewed all tracked paths, migrations, SQL tests, account/ranked clients, Edge handler, rendering sinks, storage, build/service worker, native configurations, workflows, package manifest/lock, fetched Git history, generated dist and Capacitor public assets. No production backend credentials or dashboard access were supplied. Only a single read-only HEAD request was made to the project's deployed Pages site; no external auth spam, deletion or exploit requests were sent.

## 3. Threat model

Anonymous attacker: invoke grants/endpoints without a caller. Normal player A/B: read/update/delete the other's known UUID records and submit the other's run ID. Modified/scripted client: bypass menus, call RPCs directly, replay, inject JSON/SQL-like/profile markup and disregard local currency rules. Compromised dependency: execute installed/build code or alter shipped assets. Malicious PR/build input: attempt to access deployment permissions or inject shell syntax through branch names. Provider administrators/service role and a compromised build dependency remain privileged trust boundaries; this POC does not simulate their compromise.

## 4. Attack surface inventory

The application is offline-first static HTML/classic JS plus Capacitor. Default build writes `{enabled:false,url:"",publishableKey:""}`. Optional Supabase email OTP is implemented with raw fetch; cloud and ranked share one activation flag. Tokens stay in closure memory. Seven public-schema tables exist: player_saves, player_profiles, ranked_runs, ranked_events, wallet_ledger, entitlements, store_transactions. Six current callable RPCs: put_player_save, set_player_profile, get_leaderboard, start_ranked_run_v2, checkpoint_ranked_round_v2, finish_ranked_run_v2. Three old ranked RPCs remain defined but revoked. The sole Edge Function verifies caller with Auth and uses a server environment credential for account deletion. No app upload, payment verification, webhook, OAuth, AI, analytics, GraphQL client, realtime subscription or custom admin runtime was found. Provider-managed GraphQL/Realtime/storage exposure is **unverified**, not inferred disabled.

Safe leaderboard projection: rank, display_name, country_code, score, achieved_at. Own Auth response necessarily contains one's UUID. Before the fix, direct authenticated profile reads exposed all users' Auth UUIDs and timestamps unnecessarily; owner-only profile RLS now avoids this. No public player identifier redesign was needed.

## 5. Security applicability matrix

See [SECURITY_REGISTER.md](SECURITY_REGISTER.md): 207 explicit topic rows with applicability, evidence/protection, tests, remaining risk and revisit trigger. Required-now means current code protection even for disabled optional integrations. Future controls are activation prerequisites; nonexistent sinks are not invented as vulnerabilities.

## 6. Tests performed

Reproduce in a disposable checkout:

```sh
npm ci --ignore-scripts
npm run validate
npm run test:backend
npx playwright test
npm audit --audit-level=high
npm run cap:sync
npm run test:security
supabase db start
supabase test db
```

The SQL malicious-client harness (`supabase/tests/003_security_attack_surface.test.sql`) directly runs real tables and RPCs under `anon` and reciprocal `authenticated` roles with controlled A/B claims, inside a rolled-back transaction. It bypasses all UI restrictions. It seeds both users' private records, attacks SELECT/UPDATE/DELETE, cross-user checkpoint/finish, direct currency/entitlement/score/event inserts, private store reads, legacy functions and missing claims, then verifies saves/runs remain intact. SQL-role injection is test fixture administration, **not** an attacker ability to set JWT claims through PostgREST. It tests the authorization boundary, not provider signature verification or actual HTTP gateway settings.

The original 49 SQL assertions continue to cover ordering, duplicate requests, durable ranked rejection, scripted checkpoint forgery and save revision conflicts. New SQL adds malformed UUID, negative/null/oversized/mass-assigned save values, oversized builds, invalid country, literal SQL metacharacters and exact leaderboard return columns. Row/advisory locks and unique indexes protect ranked ordering; no duplicate Task 01 concurrency infrastructure was added. Real simultaneous save/delete transactions and gateway races remain staging work.

Deletion tests call the real handler with mock Auth/admin transport. Missing/malformed bearer, random/expired/forged/revoked/missing-claims rejection simulations, invalid JSON/null/array/confirmation, wrong origin, dangerous methods, malformed provider UUID and provider exceptions cannot trigger admin deletion. An existing test supplies B's user_id with A's valid identity and observes only A's admin URL. These tests prove the application obeys Auth's decision; they do not test Supabase cryptography, real expiry or revocation.

Browser tests inject harmless image/onerror-like text through cloud save and leaderboard. It remains text/value; no image element or execution occurs. Access/refresh fixture tokens, OTP and email do not enter localStorage/sessionStorage/cookies. Reload requires sign-in. A delayed mocked refresh reproduces a real application race: before the fix two save calls occurred, including the retry after sign-out; after the fix only the original pre-sign-out call occurs. Synthetic credentials only appear in local test traces; no live secrets are used.

Boundary tests demonstrate service-worker exclusion of cross-origin API, non-GET and cloud configuration and rejection of privileged build keys/invalid origins without printing values. Scanner self-tests inject synthetic private/provider secrets, assert redaction and prove an invalid repository causes a nonzero exit. Missing artifacts, malformed config, Git/read errors and shallow history fail the scanner closed. npm audit transport failures also fail CI.

Secret review covered tracked source, HTML/JS/native/XML/plist/resources, docs, SQL, Edge code, workflows and 328 distinct historical blobs reachable from fetched refs. Initial source/dist scan: 186 files; after Capacitor sync and additional tests: 249 files, zero matches. Scanner emits only location/type/SHA-256 prefix; no complete matches. No rotation requirement was identified. Pattern scanning cannot rule out arbitrary strings, encrypted/binary payloads, unfetched/deleted remote refs, external CI log history or provider secrets. Original unrelated untracked databases were outside repository scope.

## 7. Findings

| ID | Title / affected component | Preconditions and attack | Observed evidence / impact | Severity / exploitability | Fix and regression | Residual risk |
| --- | --- | --- | --- | --- | --- | --- |
| SEC-01 | Refresh resurrects a signed-out session, account.js | Cloud enabled, valid session, refresh response delayed across sign-out | Browser POC observed 2 save requests versus expected 1; stale token restored and authenticated retry sent after local logout | MEDIUM; realistic network timing on shared device, no cross-user data breach demonstrated | Epoch guard before storing refresh and sending/retrying authorized requests; security-browser race test | Already dispatched requests cannot be recalled; provider JWT revocation semantics still apply |
| SEC-02 | Unnecessary public Auth UUIDs, player_profiles | Signed-in player directly SELECTs profiles | Baseline policy `using (true)` grants every profile column including user_id; enables account correlation/enumeration, not credential theft | LOW; trivial when backend enabled | New migration owner-only profile policy; 2 reciprocal profile read attacks and exact leaderboard projection test | User-supplied names/countries and scores are intentionally public to signed-in leaderboard users |
| SEC-03 | Mutable CI action references | Upstream tag/branch changes or compromise | Eight distinct mutable action refs used in build/deploy; no compromise observed | LOW; conditional upstream control, deployment supply-chain impact | Pin all eight to upstream resolved commits, remove persisted checkout credentials; CI executes pinned refs | Pins do not audit transitive downloads; review updates and upstream provenance |
| SEC-04 | Unhandled deletion transport errors | Provider/network throws during Auth/admin fetch | Baseline handler had no catch; exception escapes application response boundary | LOW; availability/diagnostic handling, no observed secret response | Generic no-store 503 and strict UUID shape; provider-throw/invalid-ID tests | Provider/runtime logging and HTTP envelopes need staging inspection |
| SEC-05 | Scripted ranked score fabrication (carried from Task 01) | Authenticated direct client, backend ranked enabled | Existing SQL submits sequential checkpoints without gameplay and finishes successfully | HIGH if activated; blocked from default shipped UI but callable on a configured backend | No final anti-cheat in Task 02; default activation asserted off | Server-verifiable gameplay evidence required before ranked activation |
| SEC-06 | RPC abuse limits absent | Authenticated direct client, activated backend | Local SQL probe accepts 20 profile mutations in one transaction; no throughput guard in RPCs; Task 01 script can create/finish runs without gameplay | INFO while inactive; production cost/availability risk | Document provider/application limit placement and staging measurement prerequisite, no arbitrary quotas | Client debounce, RLS, one-active-run and idempotency do not limit aggregate demand |

No confirmed Critical finding. Counts: High 1 (existing activation blocker), Medium 1, Low 3, Info 1. No claim that no other vulnerability exists.

## 8. Fixes implemented

Epoch-bound refresh/request continuation and service-worker cache revision; owner-only profile reads; deletion exception sanitization and strict identifier format; eight immutable action pins; checkout credential persistence disabled; install scripts disabled; explicit workflow timeouts; a required Security baseline job with high/critical npm audit and redacted full-history/artifact scan. Android and iOS jobs scan their generated public bundles before building. Existing aggregate check requires security success along with all existing jobs. No authorization grant widened, RLS disabled, production credential added or activation flag enabled.

## 9. Measurements

| Measurement | Result / scope |
| --- | --- |
| Secret-pattern findings | 0 in initial 328 historical blobs and 249 source/generated asset files; final scan includes new files and commits |
| Cross-user attempts | 34 new SQL assertions: 10 reads, 20 direct update/delete attempts, 4 ranked RPC mutations; outcome must be confirmed by database CI |
| Unauthorized access / mutation successes | Target 0 / 0; do not equate authored assertions with executed database evidence; CI evidence recorded below |
| Malformed request cases added | 19: 11 SQL malformed inputs, 3 bearer shapes, 4 JSON/body shapes, 1 invalid provider UUID; plus 5 mocked credential rejection classes and 4 disallowed methods |
| Dependency advisories | npm audit: 0 Critical, 0 High, 0 Moderate, 0 Low, 0 Info; 105 dependencies (8 production, 98 development per npm metadata overlap) |
| Install-script / integrity review | No hasInstallScript lock entries; registry dependencies carry integrity hashes; direct runtime packages used by native bridge |
| New regression cases | 86 pgTAP + 8 Node deletion + 5 Node scanner/boundary + 2 browser scenarios = 101 logical cases; browser scenarios run on desktop and mobile |
| Build artifact findings | 0 credential patterns; no source maps, .env, test directory or backend source in dist; readable source is intentional static deployment |
| CI findings | Eight mutable action refs fixed; inherited long default timeouts replaced; default permissions already read-only and deployment already main-only |
| Session race | Before: 2 save calls. After: 1 (zero authenticated retries after sign-out) |
| Rate probe | 20 local profile mutations permitted; no load test or production quota inferred |

Local verification: static validation, 23 backend tests, 5 scanner/boundary tests, production build, Capacitor sync and focused browser tests pass. Full browser/native/database CI evidence is recorded in the PR; this machine has no Docker/Supabase CLI. CI status must be checked before accepting this task; a queued, action_required or running workflow is not a pass.

## 10. Remaining risks

Hosted project settings are unknown. Before activation test actual JWT expiry/revocation, stale/deleted-account credentials, creation/deletion cascades over HTTP, OTP enumeration status/timing, refresh across devices, provider error redaction and deployed Edge CORS. Password recovery is not implemented; email OTP is the recovery/sign-in mechanism. UI uses generic OTP errors but direct provider responses can differ; no assertion of enumeration resistance is made from UI wording alone. Auth doesn't rely on app cookies: classic ambient-cookie CSRF is not the current boundary, while XSS and stolen Bearer tokens remain meaningful. Origin checks/CORS are browser controls, never authorization for scripted clients.

The service worker caches same-origin GETs beyond its initial asset list, but current authenticated services are cross-origin and excluded. Revisit before same-origin private routes. Source maps absent; unminified JS is public by design, no hidden security logic is relied on. SQL errors may include schema/constraint names through provider APIs; malformed SQL inputs are rejected but hosted error envelopes are not certified sanitized. Display markup is safe in tested sinks; a malicious same-origin dependency could still read in-memory tokens.

Pages HEAD on 2026-09-27 returned HTTP 200, `strict-transport-security: max-age=31556952`, public CORS and 600-second cache control. CSP, X-Content-Type-Options, Referrer-Policy, frame restrictions and Permissions-Policy were absent. This app cannot set arbitrary response headers through its current static build. A tested meta CSP/referrer policy can cover some behavior, but frame-ancestors needs response headers; choose hosting/proxy policy before sensitive activation. No unsupported assertion that Pages serves application-controlled security headers is made.

Android: INTERNET is justified by optional accounts; only launcher exported; FileProvider not exported, backups disabled; target API 36 and no cleartext exception; release not marked debuggable, mixed content false. iOS has no ATS exception, associated-domain entitlement or registered OAuth URL scheme; platform forwarding methods alone do not configure a deep-link identity flow. debug.xcconfig is attached only to Debug; CI simulator build is intentionally Debug. No privileged signing credential was found; signed store-release/device testing remains a release prerequisite. Broad dormant FileProvider paths should narrow if sharing is introduced.

## 11. Deferred topics and why

Provider Auth defaults currently documented: built-in email service 2 emails/hour/project, OTP repeat interval 60 seconds/user, signup/sign-in and verify typically 30 requests/5 minutes/IP, token endpoint 150/5 minutes/IP. These are provider documentation, **not measured project settings**; inspect dashboard before activation. Place OTP/signup protection in provider settings/CAPTCHA as appropriate; authenticated RPC quotas need database or authenticated gateway enforcement; deletion needs Edge/provider abuse and recent-auth policy; profile mutations, checkpoint traffic, ranked creation and leaderboard reads need measured staging budgets. Do not interpret the 20-write probe as a proposed limit. [Supabase rate limits](https://supabase.com/docs/guides/auth/rate-limits).

Supabase access JWTs may outlive sign-out until expiration; session configuration and endpoint behavior must be explicitly tested, not replaced with custom crypto. [Supabase sessions](https://supabase.com/docs/guides/auth/sessions).

Before storing production user data, choose RPO/RTO and retention, verify provider plan backup/PITR capabilities and restore into an isolated project. Include users/saves/profiles/ranked history and later economic evidence; validate post-restore deletions and transaction reconciliation. Backups and PITR are plan-dependent; no unnecessary backup system was built. [Supabase backups](https://supabase.com/docs/guides/platform/backups).

Payments, receipt verification/refunds, webhook signatures/timestamps/replay, upload MIME/content/bucket rules, OAuth audience/issuer/state/nonce/linking, GraphQL authorization, realtime subscriptions, analytics consent/retention, admin IAM and AI prompt/output/tool boundaries are in the register. No production runtime for these was added. Repository owner review and CI apply to AI-generated code now.

## 12. Decision

**MODIFY.** The current baseline is suitable for continued development and review after all CI passes. It is not production security approval. Keep cloud/ranked activation off while provider configuration, abuse controls, recovery/monitoring and server-verifiable ranked integrity remain unresolved. Owner review and manual merge remain required.

## 13. Architecture impact

Treat the server's caller identity as authoritative and invalidate every asynchronous auth continuation when the session changes. Expose deliberate leaderboard fields instead of whole profile records. Keep economic writes server-only; no local coins or receipt flags may become authority. Future feature PRs must update the register, supply a realistic attack test and record evidence/residual risk before activation. Separate account rollout from competitive rollout. Add a disposable full Supabase gateway/Auth staging exercise before social identity or production services. Task 01 sequential reliability is not anti-cheat.

### Action pin provenance and update strategy

Resolved against official upstream Git refs on 2026-09-27. All replacements preserve the existing action family/major; setup-cli v2 is a branch, not a tag. Pins reduce mutable-ref risk, as recommended by [GitHub's secure-use guidance](https://docs.github.com/en/actions/reference/security/secure-use). Review upstream release/commit provenance and rerun the full suite on each update; do not automatically float tags. Pins do not freeze downloaded Node/JDK/CLI/native toolchains or dependencies inside actions.

| Action | Previous ref | Pinned commit |
| --- | --- | --- |
| actions/checkout | v4 | 11d5960a326750d5838078e36cf38b85af677262 |
| actions/setup-node | v4 | 49933ea5288caeca8642d1e84afbd3f7d6820020 |
| actions/setup-java | v4 | cf277c60eb25467037889841efdb72551f06f6c3 |
| actions/upload-artifact | v4 | ea165f8d65b6e75b540449e92b4886f43607fa02 |
| supabase/setup-cli | v2 branch | afb1b15109756ea5cf9d8985a359d9095235ca2b |
| actions/configure-pages | v5 | 983d7736d9b0ae728b81ab479565c72886d7745b |
| actions/upload-pages-artifact | v3 | 56afc609e74202658d3ffba0e8f6dda462b719fa |
| actions/deploy-pages | v4 | d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e |

Read-only GitHub inspection found active main rulesets 23950494 and 23387408 requiring `Static and browser tests`, an approving review, and code-owner/conversation controls. Legacy branch protection API returned 404 because rulesets enforce these requirements instead. No rules were modified or bypassed. PR builds use synthetic fixtures and no repository production secrets; failure traces may contain fixture emails/tokens and expire after 7 days. Release APK/AAB artifacts remain debug/unsigned review builds, not automatically distributed store releases.
