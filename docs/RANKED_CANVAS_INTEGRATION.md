# Gated ranked canvas integration

## Objective

Connect the measured canvas core to the ticket/session recorder without enabling
public ranked play or changing the gameplay hash registered in staging.

## Architecture rules

`src/game/ranked-bridge.js` exposes explicit physics, input, initialization and
lifecycle ports around the existing ordered scripts. `src/cloud/ranked-canvas.js`
is an ES module that owns ticket waiting, recording, submission, retries and
forfeits. It receives an authenticated network adapter, an approved ruleset and
an explicit enabled predicate. The production build still rejects ranked
activation. No server credential belongs in either client module.

The integration awaits a server-issued seed before resetting the game. Each
60 Hz step records its target coordinates before advancing the measured core.
Pause and resume are chronological entries. Submission contains only the opaque
ticket, receipt key and inputs. A queued receipt does not grant a score, currency
or entitlement. Response-loss retries preserve the original immutable payload.

## Prohibitions

Do not enable the registered ruleset, expose a service key, reconnect checkpoints,
infer verified scores from local best rounds, or silently classify offline play
as ranked. Test-injected ticket responses are browser fixtures, not evidence of
hosted ticket issuance. There is no ranked button or provider activation in this
change. The existing account bridge's retired callbacks remain inert.

## Implementation

Load the classic bridge after the bonus system and account script. The build
bundles both ES modules locally, and the offline cache includes the bridge and
controller. Ordinary gameplay delegates directly to the existing update function.

For an approved future account integration, construct one controller with
`createRankedCanvas({network, ports:window.EchoStepsRankedPorts, ruleset,
isEnabled:()=>approvedConfig.rankedEnabled})` and invoke `begin(profile)` from a
separate ranked entry point. Do not replace the ordinary PLAY handler with an
unconditional network request. Reuse that controller for subsequent completed or
forfeited runs after returning to a start/over screen. Keep authentication refresh
inside `createSecureNetwork`'s token callback, not in global token variables.

The approved profiles currently require exact 393x727 or 1280x646 canvas CSS
dimensions and zero safe-area offsets. Unsupported geometry is refused; a change
during recording forfeits the run. General native screen sizes require a measured
letterboxing/input-transform phase before activation. Revive, restart, menu,
invalid timestep, lifecycle violations, input limits and asynchronous simulation
fallbacks forfeit recording. The local game can continue without a ranked result.

## Tests and evidence

Node tests cover disabled intake, pending ticket freeze, duplicate startup, late
responses after cancellation, lifecycle ordering, changed viewports, immutable
receipt retries, and invalid time steps. Browser tests exercise actual pointer
controls and pause/resume, then compare the resulting transcript against the
server harness's round, frame, PRNG state and player position on both profiles.
Existing guest, offline, account, security and native-build checks remain required.

Hosted evidence already collected separately: migrations and transaction smoke
checks passed; both Edge bundles are active; 24 authenticated closed-gate checks
passed and both disposable accounts were removed. The Mac child-process probe
proved deterministic results, ruleset rejection and wall deadline enforcement.
Those reports do not prove hosted valid ticket-to-score acceptance or production
OS isolation. No permanent worker host was provisioned.

## Acceptance gate and next phase

Require exact-head CI and owner approval/merge. Then establish an isolated staging
validation lane for real tickets without opening the public ruleset, measure
native viewport transforms, and choose a worker host with a confirmed budget,
non-root/read-only execution, child network isolation and resource monitoring.
Preferred sign-in providers, physical secure-storage behavior and store signing
remain release gates. Public ranked activation remains disabled throughout.
