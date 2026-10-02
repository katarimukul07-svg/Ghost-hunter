# Echo Steps: Garbage Collector

A minimalist arcade survival game where every completed route becomes a lethal echo. Collect the prize, escape, and survive your own history until the Garbage Collector clears old paths.

## Current status

The repository contains the web game plus Capacitor 8 projects for Android and iOS. Version 1.0 is in release-candidate preparation and still requires protected CI, real-device beta testing, signing, and store-owner approval before submission.

Simulator UI follow-up (#38): pause uses CSS bars instead of a font-dependent glyph;
results and sharing explicitly count completed rounds. Scoring and gameplay rules
are unchanged. Browser regression tests cover the icon, pause/resume, and result/share
counts; visual confirmation on a rebuilt iOS candidate and physical-device testing remain release gates.

- Live game: <https://katarimukul07-svg.github.io/Ghost-hunter/>
- Release plan: [ROADMAP.md](ROADMAP.md)
- Release checklist: [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)
- Store listing draft: [STORE_LISTING.md](STORE_LISTING.md)
- Development process: [WORKFLOW.md](WORKFLOW.md)
- Backend foundation and release gates: [docs/BACKEND_PLAN.md](docs/BACKEND_PLAN.md)
- Owner-controlled automation design: [docs/PROJECT_AUTOMATION.md](docs/PROJECT_AUTOMATION.md)
- Task 03 gameplay replay evidence and remaining activation gates: [docs/RANKED_GAMEPLAY_POC.md](docs/RANKED_GAMEPLAY_POC.md)

Task 03 adds an offline verifier that replays the real game rules from bounded
pointer inputs. Browser traces and synthetic attacks are tested in CI; the
research adapter and verifier are not bundled into the game. Gameplay random
choices now use a separate reproducible stream so cosmetic draws cannot change
future layouts. `npm run poc:replay` writes a machine-readable campaign report.
This proves rule consistency, not human play or production anti-cheat. Existing
ranked RPCs remain forgeable and production cloud/ranked activation stays off.

Mobile release validation: steering belongs to one pointer and clears on capture
loss, pause, focus/background interruption, and restart. Narrow-phone HUD cards
stay above the arena. CI includes a focused WebKit phone suite as well as desktop
and mobile Chromium. On 1 October 2026, the new regression suite reproduced five
failures before the fixes; afterward 55 backend and 85 browser tests passed
locally. Safe-area tests inject inset values and lifecycle tests simulate events;
they do not replace physical-device acceptance.

## Controls

- Desktop: click and drag to steer the node.
- Mobile: drag with one finger; the control target is offset above the finger for visibility.
- Collect the pulsing yellow diamond, then enter the green exit. Red flickering circles are ghosts.
- Avoid obstacles and the echoes replaying earlier routes.

## Core systems

- Completed routes become replaying ghosts.
- After every 10 completed rounds, the Garbage Collector removes 4 old ghosts, then 3, then 2, and finally 1 at round 40 and each later milestone.
- Obstacles increase, grow, drift, and change shape as the run advances.
- Progress, coins, cosmetics, sound settings, and best score currently persist in local storage on one device.
- An optional account and non-economic sync client is built but disabled by default. It requires reviewed backend, privacy, and deletion setup before activation.
- Version 1.0 has no paid coin packs, ads, analytics, tracking, accounts, or network dependency.

## Development

Requirements: Node.js 22 or newer. Native development additionally needs Android Studio 2025.2.1+ with API 36 or macOS with Xcode 26+.

```bash
npm install
npx playwright install chromium
npm test
npm run serve
npm run cap:sync
```

Then open <http://localhost:4173>.

`npm test` runs structural checks plus desktop and mobile browser tests. CI also compiles an API 36 Android APK and an unsigned iOS simulator build for every pull request and every change merged into `main`. The protected `Static and browser tests` gate succeeds only when all three jobs pass. Only a gated `main` build is eligible for deployment. After GitHub Pages deploys, CI checks that the live site serves the exact commit and its core game assets; a failed live check marks the deployment job red.

The automated player in `tests/automated-player.spec.js` uses the canvas controls to collect a prize and complete the first round, then checks that the recorded path replays as a moving ghost. A separate generator stress test advances from the exit through every round up to 100 across seeded desktop and mobile layouts, checking prize clearance and paths to the prize and exit. It tests layout generation, not survival against 100 ghosts. The suite also verifies a wall collision and sends a finger drag on mobile Chromium; game over and restart are covered separately. Run the browser suite with `npx playwright test`. On failure, Playwright retains a trace and attaches a JSON replay or failing round snapshot. The layout and collision fixtures are exposed only when the game loads with `?test=1`.

## Repository layout

```text
.
├── .github/workflows/ci.yml  # gated validation and GitHub Pages deployment
├── android/                  # Capacitor Android project (API 24–36)
├── ios/                      # Capacitor iOS project (iOS 15+)
├── assets/                   # source icon, install icons, and splash artwork
├── src/
│   ├── game/                 # fixed settings, arena, state, gameplay, rendering, controls
│   │   └── systems/          # fairness, garbage collection, and timed bonuses
│   ├── platform/             # native lifecycle and haptics adapter
│   ├── rendering/            # selectable arena backgrounds
│   └── ui/                   # tutorial and menu-facing features
├── styles/game.css           # web game presentation
├── capacitor.config.json     # native application identity and bundled web directory
├── index.html                # small application shell and script composition
├── privacy.html              # public privacy policy
├── support.html              # public support page
├── tests/                    # focused shell, gameplay, bonus, and background browser tests
├── scripts/validate.mjs      # dependency-free validation
├── ARCHITECTURE.md           # source boundaries and runtime composition
├── ROADMAP.md                # Version 1.0 scope and release gates
└── WORKFLOW.md               # contribution and release workflow
```

The Version 1.0 web source is organized by responsibility while preserving the
tested runtime order used by the original prototype. See [ARCHITECTURE.md](ARCHITECTURE.md)
for module boundaries and the remaining migration work.

## Gameplay tuning

Fixed gameplay settings and selectable content live in `src/game/config.js`.
Other game files read from that file; values that change during a run remain
with their owning system or in `src/game/state.js`. `CFG` includes:

| Key | Meaning |
|---|---|
| `SPEED_FRAC` | Player speed relative to the room diagonal |
| `GC_MOVES` | Rounds between Garbage Collector sweeps |
| `GC_REMOVE_START` | Echoes removed by the first collection |
| `GC_REMOVE_MIN` | Minimum echoes removed by later collections |
| `RAMP_START` | Round where drift and ghost acceleration begin |
| `GHOST_RAMP` | Per-round ghost-speed multiplier after the ramp starts |
| `WALL_DRIFT` | Obstacle drift speed |
| `OBSTACLES_*` | Obstacle-count progression |
| `SIZE_*` | Obstacle-growth progression |
| `GRACE_TICKS` | Temporary collision grace after a round transition |

## Deployment

GitHub Pages deployment is defined in `.github/workflows/ci.yml`. A pull request must pass web, Android, and iOS build checks; after a tested change reaches `main`, the workflow builds `dist/` and deploys it. Capacitor packages those same tested local assets into native projects instead of loading the hosted website inside the app.

Ranked checkpoint submissions and the legacy leaderboard are retired. Account
activation cannot enable them. See [ranked containment and next gates](docs/RANKED_CONTAINMENT.md).

The replay service and native session-storage staging candidate are documented in
[Ranked service implementation](docs/RANKED_SERVICE_IMPLEMENTATION.md). Store
listing drafts and remaining physical-device/signing gates are in the
[store packet](docs/release/STORE_PACKET.md). Default guest play and ranked
activation remain independently gated until hosted/native evidence is complete.

The gated [ranked canvas adapter](docs/RANKED_CANVAS_INTEGRATION.md) records the actual fixed-tick inputs without changing the pinned gameplay ruleset. Public ranked activation remains blocked.

### Shop preview and confirmation
Tap a locked cosmetic to preview without spending coins. Buy opens a confirmation
showing the cost, current coin balance, and balance after purchase. Confirm spends
earned coins once and equips the item; Cancel preserves the balance and selection.
Owned cosmetics equip on tap. Insufficient funds disable buying.

Background progression: Classic Grid is free; Circuit Foundry costs 40 coins,
Abyssal Network 60, and Orbital Station 90. The ordering reflects increasing
visual detail, with Orbital Station's planet glow and orbit rings priced highest.
Background ownership stays on the device, like other coin cosmetics.

Touch controls: tap a destination (including the target or inside the exit) to
move to that exact spot. Drag to steer with the NODE above the finger. The
visibility offset starts only after moving more than 8 pixels; obstacles still
block direct routes. The tutorial explains both controls.

Ghost path lines are 4 pixels wide (previously 2), including during collector sweeps.

The main menu now uses a short goal summary and playful tagline instead of the longer NODE/echo explanation; detailed rules stay in How to Play.
