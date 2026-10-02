# Ghost Hunter UI and control audit

## Implemented changes

- Use Ghost Hunter consistently in visible web/native names, tutorial and sharing. Existing bundle IDs and local save keys remain unchanged.
- Use dot, coin, ghost and sweep terminology; show Owned and Equipped in the shop.
- Increase secondary text contrast, shop label sizes and swatch/tab touch areas. Locked choices retain full color for useful previews.
- Buy is green and Cancel is red. The compact purchase dialog remains centered. Shop content can scroll on shorter screens.
- Add eye marks to ghost bodies in gameplay and previews so a green ghost has a visual cue beyond its color. Collision geometry stays unchanged.
- Honor reduced-motion preference for ghost flicker, camera shake and button transitions. This is partial support; other effects still animate.
- Ramp the finger visibility offset after the 8px drag threshold, rather than applying 52px instantly. Keep tap destinations exact and retain single-pointer steering ownership.

## Control experiment

Question: does crossing the touch drag threshold abruptly move the destination?
Hypothesis: progressively applying the offset removes the abrupt shift.
Acceptance criterion: the measured destination displacement for a one-pixel move across the threshold is at most 2px.

Both Chromium and WebKit measured 52.01px before and 1.41px after. A regression test enforces the criterion across desktop Chromium, mobile Chromium and mobile WebKit. Physical-device feel remains pending.

## Long-session experiment

Question: how do replay storage and synchronous canvas submission scale with simulated rounds?
Method: `research/release-audit/measure.mjs` disables requestAnimationFrame, advances 60Hz simulation ticks, suppresses deaths and forces round completion. Each round has 1,200 samples; rendering is submitted 200 times at selected rounds. This isolates growth and submission work, not legitimate human survival.

| Probe | Before | After |
| --- | ---: | ---: |
| Idle 10 simulated minutes: added route samples | 36,000 | 36,000 |
| Round 30: ghosts / retained samples | 22 / 26,400 | 22 / 26,400 |
| Round 100: ghosts / retained samples | 84 / 100,800 | 84 / 100,800 |
| Round 100 Chromium render p95 | 0.8ms | 0.8ms |
| Round 100 WebKit render p95 | 9ms | 8ms |

Decision: retain replay semantics in this UI pass. Unbounded recording and increasing ghost storage remain technical risks. The small render timing difference is not evidence of a performance improvement. Require an iPhone profile before choosing replay compression or retention limits; either could alter ghost timing and game difficulty.

Evidence: `AUDIT_BASELINE.json` and `AUDIT_AFTER.json`, with source hashes. Reproduce after building and serving `dist` on localhost:4174, then run `node research/release-audit/measure.mjs`. Browser versions, hardware and timer precision affect timings. This is Mac browser emulation with accelerated simulation, not phone FPS, GPU completion, battery, temperature or heap measurements.

## Validation

`npm test`: backend/static validation passed, 101 browser tests passed and 1 skipped. Visually inspected WebKit 390x844 menu and purchase dialog. Existing phone-size and injected-safe-area regressions passed. These checks do not replace native iPhone acceptance.

## Remaining acceptance gates

Physical iPhone, on the rebuilt candidate:
1. Play offline; buy a cosmetic, check exact debit and ownership, cancel another purchase, relaunch and confirm saved coins/equipment.
2. Lock/unlock and background/foreground during steering; confirm pause and safe input reset. Check notch, small-screen scrolling and purchase confirmation.
3. Play at least 20 minutes and profile frame pacing, heap growth and temperature on device. Record device, OS, commit, session length and rounds. Investigate sustained frame-time spikes or continuing memory growth before release.
4. Check green ghost versus green exit in motion, tap collection/exit entry and gradual drag offset with a finger. Verify reduced-motion preference on device.

Fresh-player beta, 5–10 participants:
- Observe first play without coaching: can they explain the goal, collect the first coin, enter the exit and understand their replay ghost?
- Record time to first successful round, early deaths, misunderstood controls, voluntary retries and why players stop. Collect consented aggregate notes; no analytics SDK is activated.
- Measure earned coins per session and time to first desired cosmetic. Revisit prices and difficulty from those observations rather than an invented target curve.
- Prioritize recurring observed failures; repeat the affected task with new players after changing it.

Store distribution still needs an eligible Apple Developer/App Store Connect setup and owner-controlled signing/submission. No paid currency, ads, cloud or ranked features are activated by this change.
