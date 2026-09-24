# Echo Steps Architecture

## Runtime shape

Echo Steps is an offline-first client application. The same tested web bundle is
deployed to GitHub Pages and packaged locally by Capacitor for Android and iOS.
There is no application backend, remote database, account service, or required
network API in Version 1.0.

## Source boundaries

- `index.html` contains the accessible application shell and ordered script composition.
- `styles/game.css` owns the visual presentation and responsive safe-area rules.
- `src/game/config.js` owns fixed tuning values and selectable content. Other
  systems read them there; live positions, scores, and timers remain runtime state.
- `src/game/` owns arena layout, state, lifecycle, rendering,
  controls, and bootstrap behavior.
- `src/game/systems/` owns collision fairness, safe spawning, garbage collection,
  touch assistance, and timed bonuses.
- `src/rendering/` owns optional arena themes.
- `src/ui/` owns guided and menu-facing experiences such as the tutorial.
- `src/platform/` isolates Capacitor lifecycle, Back-button, status-bar, and haptic behavior.
- `tests/` groups browser behavior by product concern.

## Load order

The game currently uses ordered classic scripts. This intentionally preserves
the shared lexical state and behavior of the original single-script prototype
while making file ownership and review practical. `scripts/validate.mjs`
enforces the order and ensures every runtime source is included exactly once.

New work should stay inside the narrowest applicable boundary. Avoid adding new
inline CSS or JavaScript to `index.html`. Do not introduce new global state when
an existing subsystem can own it.

## Build and deployment

`npm run build` creates `dist/` from the application shell, source directories,
stylesheet, static pages, web manifest, service worker, and artwork. Capacitor
syncs this same directory into the native projects. CI validates the source,
runs desktop and mobile browser tests, compiles Android and iOS, and deploys only
a successful `main` build to GitHub Pages.

## Future backend boundary

If cloud saves, accounts, leaderboards, purchases, or server-verified rewards are
introduced, their API contract should remain separate from the deterministic game
core. The client must continue to launch and play offline when those services are
unavailable.
