# Echo Steps: Garbage Collector

A minimalist arcade survival game where every completed route becomes a lethal echo. Collect the prize, escape, and survive your own history until the Garbage Collector clears old paths.

## Current status

The repository contains the web game plus Capacitor 8 projects for Android and iOS. Version 1.0 is in release-candidate preparation and still requires protected CI, real-device beta testing, signing, and store-owner approval before submission.

- Live game: <https://katarimukul07-svg.github.io/Ghost-hunter/>
- Release plan: [ROADMAP.md](ROADMAP.md)
- Release checklist: [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)
- Store listing draft: [STORE_LISTING.md](STORE_LISTING.md)
- Development process: [WORKFLOW.md](WORKFLOW.md)

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

`npm test` runs structural checks plus desktop and mobile browser smoke tests. CI also compiles an API 36 Android APK and an unsigned iOS simulator build for every pull request. The protected `Static and browser tests` gate succeeds only when all three jobs pass. Only a gated `main` build is eligible for deployment.

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
