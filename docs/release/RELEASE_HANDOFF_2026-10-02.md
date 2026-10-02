# iOS release handoff — 2 October 2026

## Verified evidence

- Release source: `982b1c5272a6d0b658e3433939194ac04aff3237` (PR #49 merged).
- [Main CI run](https://github.com/katarimukul07-svg/Ghost-hunter/actions/runs/36975087308) passed web, security, database authorization, Android builds, iOS simulator build, aggregate gate, and Pages deployment verification.
- A Debug device build of that source succeeded locally and was installed on the paired iPhone 14 Pro on 2 October. The bundled build-info now contains the source revision instead of `local`.
- Bundled cloud configuration has `enabled: false` and `rankedEnabled: false`, with empty provider URL/key. Release scope is offline guest play with earned-coin cosmetics; no paid purchases, ads, cloud accounts, or public ranked play.
- Owner reported repeated physical-device testing without observed issues. This is owner-reported evidence, not a completed observation sheet or independent gameplay/performance measurement.

## Blocking distribution evidence

- The existing archive under the Mac temporary directory is older than current source: 20 bundled files differed when inspected. Do not upload it.
- The inspected archive/device profiles have `LocalProvision: true`, `get-task-allow: true`, and expiry 9 October 2026. They are temporary local development profiles, not App Store distribution evidence.
- The owner encountered an account-not-enabled message in App Store Connect. Actual membership/enrollment status and the available distribution team remain unverified.
- The installed application reports version 1.0, build 1. A later store upload must use an appropriate unique build number and distribution signing.

## Next actions

1. Verify Apple Developer membership and the matching Apple account through the web account portal. If already enrolled, resolve pending activation/team access; do not purchase duplicate enrollment.
2. Configure the eligible distribution team in Xcode. Build a fresh Release archive from an approved commit with revision metadata; validate and upload to App Store Connect.
3. Test the TestFlight-delivered binary: cold launch in airplane mode, all three music tracks, interruption/resume, saved progress after force-close, and a full gameplay session.
4. Capture accurate screenshots and complete support/privacy, age rating, export-compliance, price/availability, and review fields from that exact binary. Owner confirms declarations; no answers are inferred.
5. Obtain final owner approval before submission, as required by WORKFLOW.md.

## Access and limitations

Apple Developer macOS app installation is blocked by the owner's current OS requirement; web account access is the continuation path. No OS upgrade/restart or changes to Garuda jobs were performed. Chrome was opened on the Mac to the Apple Developer account portal. Local Mac Chrome is not exposed through the current browser-control interface, so this handoff does not claim inspection or completion of its signed-in account screens.

No TestFlight upload, membership purchase, legal agreement acceptance, or App Review submission was performed.
