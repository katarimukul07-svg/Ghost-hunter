# Echo Steps: Garbage Collector — Version 1.0 Roadmap

## Product direction

Version 1.0 will be a focused, replayable mobile arcade game. The launch build keeps the core hook—each completed route becomes a lethal echo, while the Garbage Collector periodically reduces accumulated danger—and avoids expanding into accounts, multiplayer, or a large content system before the core game is proven.

## Version 1.0 scope

Included:

- Fast portrait-mode runs with touch controls, pause/resume, haptics, synthesized audio, and offline play.
- Fair shape-aware collisions, reachable prizes, protected exits, and a Garbage Collector that meaningfully relieves pressure.
- Local best score, earned coins, cosmetic unlocks, and coin-funded retries.
- Optional rewarded ads for a revive or coins after a real provider is connected and consent is implemented.
- Crash reporting and minimal privacy-conscious gameplay analytics for balancing.
- Android and iOS packages, store assets, privacy disclosures, age ratings, and closed testing.

Not included in the initial launch:

- Paid coin packs or other in-app purchases.
- Player accounts, cloud saves, or a global leaderboard.
- Daily challenges, multiplayer, or live events.
- Advertising that interrupts active gameplay.

These are post-launch options only if retention data supports them.

## Milestones

### M0 — Stable web build

- Split the monolithic prototype into maintainable presentation, game-core, platform, and bootstrap modules.
- Fold `gameplay-fixes.js` into owned source code and remove runtime monkey-patching.
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

### M4 — Post-launch

- Fix launch issues before adding features.
- Review retention, round completion, death causes, retry usage, ad completion, and cosmetic engagement.
- Consider daily challenges and leaderboards only after the launch loop demonstrates retention.

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
