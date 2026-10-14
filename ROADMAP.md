# Echo Steps: Garbage Collector — Version 1.0 Roadmap

## Product direction

Version 1.0 is a focused, replayable mobile arcade game built around score competition. It keeps the core hook—each completed route becomes a lethal echo, while the Garbage Collector periodically reduces accumulated danger—and ships on iOS first with a Game Center leaderboard and optional App Store coin packs. Our own server-verified leaderboard follows the Google Play release.

**Status (Oct 14, 2026):** iOS 1.0 (build 16) is submitted to App Review and set to release automatically no earlier than Oct 15, 2026. Store details are recorded in [STORE_LISTING.md](STORE_LISTING.md).

## Version 1.0 scope (iOS, build 16 in App Review)

Included:

- Fast portrait-mode runs with touch controls, pause/resume, haptics, music and synthesized sound effects, and offline play.
- Fair shape-aware collisions, reachable prizes, protected exits, and a Garbage Collector that meaningfully relieves pressure.
- Local best score, earned coins, cosmetic unlocks (player, trails, ghosts, death effects, arenas), and coin-funded revives (50 → 100 → 200 → 400 per run).
- **Game Center leaderboard** `echosteps.rounds.alltime` (best rounds reached), with a 0–5000 score range in App Store Connect.
- **Three StoreKit 2 coin packs**: 200 coins $0.99, 1,200 coins $4.99, 3,000 coins $9.99. Coins are credited only after StoreKit verifies the transaction.
- App Privacy: Data Not Collected.

Not included in 1.0:

- Ads (rewarded ads arrive in iOS 1.1 and at the Google Play launch, #66).
- Analytics or crash reporting beyond App Store Connect's built-in stats.
- Player accounts or cloud saves of our own.
- The Supabase server-verified leaderboard, which connects once the Google Play version is released (#63).
- Daily challenges, multiplayer, or live events.
- Advertising that interrupts active gameplay.

The UI review changes merged in PR #78 and the owner testing fixes ([build 16 notes](docs/release/TESTING_NOTES_BUILD_15.md): audio resume, later first exit move, centered priority notices, rewritten captions, 10 obstacle shapes) ship in 1.0 itself as build 16. Build 13 (uploaded as 1.0.1) is superseded. Google Play (#51) needs Google Play Billing and Play Games before it matches iOS.

## Milestones

### M0 — Stable web build

- [x] Split the monolithic prototype into maintainable presentation, game-core, platform, and bootstrap source boundaries.
- [x] Replace the root-level `gameplay-fixes.js` patch file with owned fairness and bonus system files.
- Replace shared global bindings with explicit ES module imports after the release-candidate behavior is locked.
- Add deterministic geometry/game-state unit tests and browser smoke tests.
- Fix resize/orientation behavior, input-state edge cases, accessibility labels, and long-run memory/performance risks.
- Remove all prototype purchase copy and inactive storefront UI.
- Establish pull-request validation and a gated GitHub Pages deployment that cannot run until tests pass.

Exit criteria: no known blocker/high-severity bugs; automated checks pass; rounds 1–30 can be repeatedly completed without impossible layouts or unfair collisions.

### M1 — Mobile alpha

- Add Capacitor with Android and iOS projects.
- Bundle all game assets locally and support safe areas, notches, lifecycle pause/resume, orientation lock, and native haptics.
- Add icons, splash assets, app identifiers, semantic versions, and signed development builds.
- Test representative small/large Android phones and iPhones.

Exit criteria: installable offline builds launch, resume, save progress, and sustain the target frame rate on real devices.

### M2 — Closed beta and monetization

- Add privacy-conscious analytics and crash reporting.
- Integrate rewarded ads with test IDs, failure handling, frequency limits, consent, and no reward until completion is confirmed.
- Tune difficulty, GC timing, rewards, retry cost, onboarding, and session length from beta data.
- Complete privacy policy, support page, Google Data Safety, and Apple App Privacy disclosures.

Exit criteria: stable closed beta with acceptable crash-free sessions, understandable onboarding, and no progression or ad dead ends.

### M3 — Store release

- Produce final screenshots, icon, descriptions, preview media, age/content ratings, and review notes.
- Run release-candidate regression testing and verify production ad/privacy configuration.
- Submit to Google Play closed/production tracks and Apple TestFlight/App Review.
- Use staged rollout where available and monitor crashes and reviews.

Exit criteria: approved Version 1.0 on both stores with support, privacy, and rollback procedures ready.

### M4 — Competitive backend

- Add optional account identity without blocking guest play.
- Use server-owned ranked sessions and sequential round checkpoints; never accept an arbitrary client score.
- Add worldwide, daily, weekly, seasonal, and country leaderboard support.
- Add server-owned wallet ledger, entitlements, and idempotent store-transaction records.
- Add native Apple/Game Center and Google identity only with official platform configuration.
- Verify every paid transaction server-side with Apple/Google before granting value.
- Add abuse scoring, rate limits, suspicious-run quarantine, and leaderboard audit tooling before public ranked launch.

Exit criteria: a modified client cannot directly mint currency, grant paid inventory, write leaderboard scores, or redeem one store transaction twice.

### M5 — Post-launch

- Fix launch issues before adding features.
- Review retention, round completion, death causes, retry usage, ad completion, and cosmetic engagement.
- Connect the Supabase server-verified leaderboard once the Google Play version is released (#63); start it fresh rather than importing Game Center scores.
- Consider daily challenges only after the launch loop demonstrates retention.

## Quality gates

Every release candidate must satisfy all of the following:

- No fake purchases, development credentials, test ad IDs, or secrets in production.
- No prize/exit soft-locks and no invisible collision zones.
- Reliable pause/resume and saved progress after interruption or app restart.
- Playable without a network connection except for optional ads/analytics.
- Accurate privacy disclosures and age/content ratings.
- Automated validation, unit tests, browser smoke tests, and a documented real-device test pass.

## Owner decisions required later

The project can proceed technically without interruption until developer accounts or production services are needed. The owner will only need to provide or approve:

- Apple Developer and Google Play Console enrollment.
- Final bundle/application identifiers and public support contact.
- Ad/analytics provider accounts and production credentials.
- Banking, tax, legal agreements, privacy disclosures, and final store submission approval.
