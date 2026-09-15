# Echo Steps: Garbage Collector

A minimalist arcade survival game where every completed route becomes a lethal echo. Collect the prize, escape, and survive your own history until the Garbage Collector clears old paths.

## Current status

The repository contains a playable web prototype hosted on GitHub Pages. It is being stabilized for a Version 1.0 mobile release; it is not yet an App Store or Google Play release build.

- Live game: <https://katarimukul07-svg.github.io/Ghost-hunter/>
- Release plan: [ROADMAP.md](ROADMAP.md)
- Development process: [WORKFLOW.md](WORKFLOW.md)

## Controls

- Desktop: click and drag to steer the node.
- Mobile: drag with one finger; the control target is offset above the finger for visibility.
- Collect the yellow prize, then enter the green exit.
- Avoid obstacles and the echoes replaying earlier routes.

## Core systems

- Completed routes become replaying ghosts.
- Every `GC_MOVES` rounds, the Garbage Collector trims old ghosts back to `GC_KEEP` survivors.
- Obstacles increase, grow, drift, and change shape as the run advances.
- Progress, coins, cosmetics, sound settings, and best score currently persist in local storage on one device.
- Paid coin packs are disabled. The code contains an adapter boundary for a future rewarded-ad provider, but no provider is connected yet.

## Development

Requirements: Node.js 20 or newer.

```bash
npm install
npx playwright install chromium
npm test
npm run serve
```

Then open <http://localhost:4173>.

`npm test` runs dependency-free structural checks plus desktop and mobile browser smoke tests. CI repeats the same checks for every pull request. Only a tested `main` build is eligible for deployment.

## Repository layout

```text
.
├── .github/workflows/ci.yml  # gated validation and GitHub Pages deployment
├── gameplay-fixes.js         # temporary fairness/platform patch layer
├── index.html                # current web prototype
├── tests/smoke.spec.js       # desktop and mobile browser smoke tests
├── scripts/validate.mjs      # dependency-free validation
├── ROADMAP.md                # Version 1.0 scope and release gates
└── WORKFLOW.md               # contribution and release workflow
```

The first Version 1.0 engineering milestone will split the monolithic prototype and fold `gameplay-fixes.js` into tested, owned modules.

## Gameplay tuning

The current tuning values live in `CFG` near the top of the inline game script:

| Key | Meaning |
|---|---|
| `SPEED_FRAC` | Player speed relative to the room diagonal |
| `GC_MOVES` | Rounds between Garbage Collector sweeps |
| `GC_KEEP` | Echoes retained after collection |
| `RAMP_START` | Round where drift and ghost acceleration begin |
| `GHOST_RAMP` | Per-round ghost-speed multiplier after the ramp starts |
| `WALL_DRIFT` | Obstacle drift speed |
| `OBSTACLES_*` | Obstacle-count progression |
| `SIZE_*` | Obstacle-growth progression |
| `GRACE_TICKS` | Temporary collision grace after a round transition |

## Deployment

GitHub Pages deployment is defined in `.github/workflows/ci.yml`. A pull request must pass structural and browser tests; after a tested change reaches `main`, the workflow builds `dist/` and deploys it. Store builds will later be produced through Capacitor rather than loading the hosted website inside an app shell.
