# Provisional cosmetic prices

Owner requested lower coin prices after playing the game. Regular coin pickups award 1 coin and cache bonuses award 3. Prices below deliberately bring the first purchase into reach at 5 regular pickups and retain ascending background prices. This is a design judgment based on known reward rules and owner feedback, not measured beta earnings or retention.

| Item | Previous coins | New coins |
| --- | ---: | ---: |
| CIRCUIT FOUNDRY | 40 | 15 |
| ABYSSAL NETWORK | 60 | 25 |
| ORBITAL STATION | 90 | 40 |
| Pulse | 15 | 5 |
| Comet | 25 | 10 |
| Blaze | 40 | 15 |
| Void | 60 | 25 |
| Sparkle | 20 | 8 |
| Long Trail | 30 | 12 |
| Rainbow | 50 | 20 |
| Violet | 20 | 8 |
| Toxic | 35 | 12 |
| Phantom | 50 | 20 |
| Shockwave | 25 | 10 |
| Confetti | 40 | 15 |
| Implode | 55 | 25 |

Default cosmetics and sound packs remain free. Existing balances, equipment and ownership persist. Purchase confirmation uses the new catalog price; repeat selection of owned items does not charge again. Earning rewards and the 100-coin revive are outside this cosmetic-price change. Historical purchase amounts are not recorded, so this does not infer old payments or issue automatic refunds.

## Affordability scenarios

Ignoring cache bonuses and spending elsewhere, the first paid dot costs 5 regular pickups instead of 15. The premium background costs 40 instead of 90. Buying all paid cosmetics costs 265 instead of 655 coins, approximately 60% less.

| Hypothetical earnings per session | Sessions for Pulse (5 coins) | Sessions for Orbit (40 coins) |
| --- | ---: | ---: |
| 3 coins | 2 | 14 |
| 5 coins | 1 | 8 |
| 10 coins | 1 | 4 |

These scenarios are arithmetic estimates, not observed player sessions. A short beginner run can still earn toward a purchase across retries, and cache collection may shorten the path. Premium goals retain room for progress.

## Validation and next decision

Existing purchase tests verify the lower exact debit, cancellation, insufficient balance, ownership and persistence after browser-process restart. Background tests verify preview-only behavior, the three new prices and the confirmed debit. Local npm test passed static/backend checks and 113 browser tests, with one skipped. Required CI must also pass before merge.

Use BETA_TEST.md and BETA_RESULTS.csv to measure actual beginner and experienced-player earnings, desired items and time to first purchase. Revisit the provisional prices if players struggle to reach the first item or quickly exhaust worthwhile purchases. Do not activate analytics, change rewards or claim an economy-score increase solely from these prices.
