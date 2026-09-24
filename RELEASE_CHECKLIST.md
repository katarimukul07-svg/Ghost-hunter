# Version 1.0 release checklist

## Automated gates

- [ ] `npm ci`, static validation, and browser tests pass on the protected pull request.
- [ ] Capacitor sync succeeds with no remote runtime assets.
- [ ] Android debug build succeeds in CI at compile/target SDK 36.
- [ ] Unsigned Android release App Bundle builds in CI; owner signs a separate store upload.
- [ ] iOS project is synced and builds with Xcode 26 on a macOS runner.
- [ ] The release commit is tagged only after all required checks pass.
- [ ] GitHub Pages deployment on the merged release commit passes its live verification.

## Real-device acceptance

- [ ] Test at least one small and one large Android phone, including API 24 and API 36 where practical.
- [ ] Test at least one notched iPhone and one smaller iPhone on iOS 15+.
- [ ] Verify 30 rounds, collision fairness, prize reachability, GC sweeps, and stable frame rate.
- [ ] Verify touch offset, pause/resume, Android Back, rotation lock, audio interruption, haptics, and saved progress.
- [ ] Verify first launch and a full run in airplane mode.
- [ ] Verify uninstall/clear-data behavior and that no unexpected network traffic is emitted.

## Store owner gates

- [ ] Approve the permanent bundle/application ID.
- [ ] Enroll in Apple Developer and Google Play Console and complete legal, tax, banking, and identity steps.
- [ ] Provide a durable public support contact and approve the privacy policy.
- [ ] Complete age/content questionnaires and final privacy declarations from the actual release binary.
- [ ] Supply signing through store-managed/App Store credentials; never commit keys or profiles.
- [ ] Complete Google closed testing if the account is subject to the 12-tester/14-day requirement.
- [ ] Approve screenshots, listing copy, price/availability, countries, and final submission.

## Rollout

- [ ] Upload Android App Bundle to internal testing, then required closed testing, then staged production.
- [ ] Upload iOS archive to TestFlight, complete external beta review if used, then submit for App Review.
- [ ] Keep the previous known-good release commit and store artifacts for rollback.
- [ ] Monitor crash reports and store reviews before expanding rollout.
