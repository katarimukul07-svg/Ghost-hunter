# Release acceptance status — 1 October 2026

Candidate acf6df624cbd860f491e60b208c5fb8869efc17f. Tests run from an isolated branch; the installed iPhone build previously verified against this commit remains the candidate.

| Area | Evidence | Status |
| --- | --- | --- |
| Tap, drag, interruption handling | Existing three-engine mobile regressions | Browser pass; physical pending |
| Shop debit, cancel, ownership, restart | Added offline persistent-browser-profile regression | Browser pass; physical pending |
| Narrow screens and safe areas | 320x568 and 390x844, injected insets | Browser pass; physical pending |
| Difficulty/onboarding | Five-to-ten-player observation kit | Pending actual participants |
| Economy | Balance/spend worksheet | Pending real sessions |
| Performance | 30.86-second iPhone Activity Monitor attachment | Limited probe; gameplay gate pending |
| Store distribution | Previously blocked distribution export | Pending eligible account/signing |

`npm test` passed static/backend checks and 104 browser tests, with one skipped. The 42-test focused acceptance run passed before the final ownership assertion was tightened; the full suite passed afterward. No game code changes are introduced by this acceptance task.

The offline test disconnects after loading local web assets, buys and cancels through UI, verifies exact coin debit, then closes and reopens the browser with the same profile. It verifies stored ownership/equipment across browser process restart. Asset loading at native airplane-mode cold launch and iOS force-close persistence are separate pending checks.

The first physical profiling attempt by PID reported “Cannot find process for provided pid: 2067”. Retrying by App name attached successfully and captured 30.86 seconds on iPhone 14 Pro/iOS 26.6. Exported samples and compact results are in acceptance-evidence/. The app's screen/activity state was not observed or controlled. The native wrapper footprint varied around 12 MB, and thermal state was Nominal during this short observation. These values exclude WebKit child processes and prove neither gameplay memory stability nor frame rate. The large trace and temporary browser profiles were deleted after exporting evidence.

[BETA_TEST.md](BETA_TEST.md) contains the next physical checks, neutral player instructions and proposed acceptance thresholds. DEVICE_ACCEPTANCE.csv and BETA_RESULTS.csv deliberately contain only pending entries. Nobody has been invited, no new-player results are fabricated, and no production analytics or accounts were activated.
