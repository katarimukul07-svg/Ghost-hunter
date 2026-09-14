# Echo Steps: Garbage Collector

A minimalist 2D arcade / twitch-survival game. Your past moves become dangerous
ghosts (Memory Leaks); a scheduled Garbage Collector periodically sweeps the
board and frees your oldest path. Outlive your own memory.

Single file, zero dependencies, no asset files — all graphics are canvas shapes
and all audio is synthesized with the Web Audio API.

## Play

- **Locally:** open `index.html` in any modern browser (desktop or mobile).
- **Online:** enable GitHub Pages (see below) and share the URL.

## Controls

Drag the blue node (mouse click-drag or one finger). Reach the yellow prize,
then the green exit, weaving around the walls. Touch a red ghost and the run ends.

## How it works

- Every completed round records your path and turns it into a red ghost that
  patrols that route back and forth (ping-pong), forever.
- The **Garbage Collector** sweep frees your oldest ghost every 10 moves, but
  only once memory holds more than a few — so early echoes persist.
- After round 7 the grid **destabilizes**: walls drift and ghosts speed up 1%
  per round (compounding).

## Tuning

All gameplay knobs live in the `CFG` object at the top of the `<script>` in
`index.html`:

| Key            | Meaning                                             |
|----------------|-----------------------------------------------------|
| `PLAYER_SPEED` | Max node speed per tick                             |
| `GC_MOVES`     | Scanner sweeps once every N moves (rounds)          |
| `GC_KEEP`      | Echoes retained before the collector starts trimming|
| `RAMP_START`   | Round after which walls drift and ghosts accelerate |
| `GHOST_RAMP`   | Ghost speed increase per round past `RAMP_START`    |
| `WALL_DRIFT`   | How fast the walls oscillate                        |
| `GRACE_TICKS`  | Collision-free frames at each round start           |

## Deploy to GitHub Pages (free live URL)

1. Push this folder to your repo (see below).
2. On GitHub: **Settings → Pages**.
3. Under *Build and deployment*, set **Source: Deploy from a branch**,
   **Branch: `main`**, **Folder: `/ (root)`**, then **Save**.
4. Wait ~1 minute; your game is live at
   `https://<your-username>.github.io/<repo-name>/`.

## Tech

Plain HTML5 Canvas + vanilla JavaScript. Fixed 1/60s logic step decoupled from
render for stable ghost sync. Pointer Events for unified mouse + touch input.
Ready to wrap with [Capacitor](https://capacitorjs.com/) for an installable
iOS/Android app later.
