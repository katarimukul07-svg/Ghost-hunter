# Build 15: owner testing notes (Oct 14, 2026)

Owner played build 14 on an iPhone and asked for these fixes before the Oct 15
launch. Build 15 replaces build 14 in App Review for version 1.0.

| Note from testing | Cause found | Fix in build 15 |
|---|---|---|
| Music and effects stop after locking the phone or leaving the app | iOS puts the audio context in "interrupted", but the game only resumed it from "suspended" | `src/game/audio.js` resumes from any non-running state, on return to the app and on the next tap |
| The first exit move comes too fast for new players | First move on round 3 (`EXIT_MOVE_OFFSET: 3`) | First move on round 8, then 13, 18… (still never on the same round as new obstacles or growth) |
| No notice when the exit moves | The notice existed but "COIN COLLECTED" fired every round and replaced it | Notices now have a priority (`notify()` in `src/game/state.js`); a lower one never replaces a higher one still on screen. The every-round coin notice is gone |
| Notices sit at the top | Drawn 18px below the top of the arena | Centered in the arena on a dark plate, readable over ghosts and obstacles |
| Too many notices | 12 notices, newest always won | Coin notice removed; priorities keep important ones visible |
| Captions feel machine-written | Terse system wording | All in-run captions moved to `CAPTIONS` in `src/game/config.js` (edit wording there) and rewritten; tutorial rewritten in the same voice |
| Obstacles should not all be edged shapes | 6 shapes | 10 shapes: added pill, star, plus and pentagon. Outlines live in `OBSTACLE_POLYGONS` and drive both drawing and collisions |

Captions are owner-approved before release.
