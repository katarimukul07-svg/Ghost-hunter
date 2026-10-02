# Ghost Hunter release acceptance and fresh-player beta

Candidate: acf6df624cbd860f491e60b208c5fb8869efc17f (PR #44). Record a different commit if testing a newer build. This protocol proposes acceptance criteria; it does not claim player results.

## Five to ten new players

Use the installed iPhone app when available. The web game at https://katarimukul07-svg.github.io/Ghost-hunter/ is available for broader feedback; label those sessions as web, since they cannot prove native acceptance. Keep existing owner saves intact. Use players who have not previously played; do not coach them or mark the tutorial complete for them.

Give each player this prompt: “Try this game for ten minutes. Tell me what you think is happening as you play.” Let them use the tutorial naturally. If they need help, record when and what you explained before helping.

Record anonymous participant IDs P01–P10 in BETA_RESULTS.csv. Do not put names, emails or recordings in the repository. Use a timer and the game's visible balance/score; mark unknown values as unknown. Leave unplayed rows pending.

Observe:
1. Can they explain collect coin → enter exit, and that old routes become ghosts?
2. Time to first completed round, best completed rounds, total runs and voluntary retries. Record early deaths and whether they understood why.
3. Tap versus drag preference, missed pickups, unintended movement and difficulty distinguishing ghosts from the exit.
4. Initial/final coin balance, coins earned, purchases/spend and the first cosmetic they want. Earned coins = final balance − initial balance + spent coins. Note bonuses separately if visible.
5. Ask afterward: “What was confusing?”, “Did any death feel unfair?”, “What would make you play again?”, and “Did the cosmetic price feel reachable?”

Suggested beta gate: at least five completed sessions; at least four of the first five players complete a round within two minutes without coaching and explain the replay ghost. Any lost purchase, crash, unreachable target or repeat control failure blocks release. A confusion reported by two or more players requires review and an affected-task retest with new players. These are practical proposed thresholds, not statistically validated retention estimates. Record failures rather than quietly changing thresholds.

## Owner's physical iPhone acceptance

Use the installed candidate; record device, iOS version and commit. Do not reinstall by deleting the app or reset personal saves.

- Airplane mode: launch, play, collect and exit. Use earned coins to buy one desired cosmetic; verify the exact debit. Cancel a different purchase; verify no debit. Force-close and reopen; confirm balance, ownership and equipment.
- During a drag: lock/unlock, switch apps and return, and pause/resume. Confirm safe pause/input reset and that a fresh gesture is required.
- Check the notch, shop scrolling and centered confirmation; tap coins/exits repeatedly. Check green ghosts are distinguishable from the exit. Repeat with Reduce Motion enabled.
- Play at least 20 minutes. Record duration, rounds, crashes, visible stalls and perceived heat. This subjective log supplements a device trace; it cannot establish FPS or heap behavior.

Record each result as pass/fail/pending in DEVICE_ACCEPTANCE.csv, with brief notes. No results are prefilled as passed. If development signing expires, stop and rebuild/sign; an expired profile is not a gameplay failure.

## Remaining technical gates

Automated browser lifecycle events, injected safe areas and offline mode validate web behavior. They do not prove iOS lock behavior, native cold launch offline, native storage after force-close, phone frame pacing or thermal performance. A browser process restart test preserves a temporary persistent profile and checks exact debit, ownership and equipment.

Long-session replay growth from UI_AUDIT.md remains open. Physical profiling must include sustained gameplay and the relevant WebKit rendering/content processes. A brief trace of the native wrapper alone cannot close that gate.

Store distribution requires an eligible Apple Developer/App Store Connect account, owner-controlled signing and submission. Earned-coin cosmetics are the current scope; real-money purchases, ads, cloud and ranked activation remain off.
