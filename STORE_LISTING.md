# Echo Steps store listing

Mirrors what was submitted to App Store Connect for iOS 1.0 (build 18, submitted
Oct 2026, status Waiting for Review). Update this file in the same PR whenever
the listing, review notes, products or privacy answers change.

## Identity

- App name: Echo Steps: Ghost Run
- Short name: Echo Steps
- Bundle/application ID: `com.mukulkatari.echosteps`
- Version: 1.0.0 (App Store version 1.0, build 18). Build 18 adds the owner testing fixes ([notes](docs/release/TESTING_NOTES_BUILD_15.md)) and replaces build 14 in App Review. Build 14 replaced build 12 for the UI review changes (PR #78); build 13 (uploaded as 1.0.1) is superseded
- Category: Games — Arcade
- Orientation: Portrait
- Release: automatic after App Review, no earlier than Oct 15, 2026 5:00 AM GMT

## Apple promotional text

> Every route becomes your next enemy. Outsmart your echoes and survive the sweep.

## Apple description

> Every path comes back to haunt you.
>
> Pilot your glowing Node through a shifting arena, collect the coin, and escape through the gate. Complete a round and your exact route becomes a deadly echo that replays forever. Plan ahead, stay calm, and survive until the Garbage Collector sweeps old echoes away.
>
> • One-finger drag controls
> • Fast portrait arcade runs
> • Shape-accurate obstacles and fair collision
> • Unlockable colors, trails, effects, and sounds
> • Game Center leaderboard: see how many rounds you can survive
> • Fully playable offline, no account required
> • No ads or tracking
> • Optional coin packs; coins are also earned by playing

## Keywords

`arcade,maze,reflex,neon,survival,offline,puzzle,dodge,one finger,retro,casual,replay`

## URLs

- Support: <https://katarimukul07-svg.github.io/Ghost-hunter/support.html>
- Privacy policy: <https://katarimukul07-svg.github.io/Ghost-hunter/privacy.html>
- Marketing: none

## Game Center (App Store Connect)

| Leaderboard | ID | Type | Score | Range | Submission | Sort |
|---|---|---|---|---|---|---|
| Best Rounds (All Time), shown as "Most Rounds" | `echosteps.rounds.alltime` | Classic | Integer (rounds reached) | 0–5000 | Best score | High to low |

Scores are submitted by the app, so the score range is the only server-side
check until the Supabase verified leaderboard ships after the Google Play
release (#63).

## In-app purchases (App Store Connect)

| Reference name | Product ID | Type | Coins | Price (US) |
|---|---|---|---|---|
| 200 Coins | `com.mukulkatari.echosteps.coins200` | Consumable | 200 | $0.99 |
| 1200 Coins | `com.mukulkatari.echosteps.coins1200` | Consumable | 1,200 (tagged Popular) | $4.99 |
| 3000 Coins | `com.mukulkatari.echosteps.coins3000` | Consumable | 3,000 (tagged Best Value) | $9.99 |

Coins are credited only after StoreKit verifies a transaction. Coins buy
cosmetics and revives (50 → 100 → 200 → 400 coins per run).

## App Review notes (submitted)

> Echo Steps is a single-player arcade game. Drag anywhere on the arena to steer the Node. Collect the gold coin, then move through the green gate to complete a round. Each completed path becomes a red echo that replays your moves. GAME CENTER: the game signs in to Game Center at launch. Best rounds reached are submitted to the Most Rounds leaderboard (echosteps.rounds.alltime); the LEADERBOARD button on the main menu and game-over screen opens it. IN-APP PURCHASES: STORE > GET COINS offers three consumable coin packs (200, 1,200, 3,000 coins). Coins buy cosmetics and revives (50 coins for the first revive in a run). Coins are also earned by playing, so no purchase is required. No account, advertising, analytics, or tracking. Progress is stored locally.

Sign-in required for review: No.

## Privacy declarations for this build

- Apple App Privacy: **Data Not Collected** (published in App Store Connect). Game Center and in-app purchases are handled by Apple; the app sends nothing to our servers.
- Ads: No
- Analytics or tracking: No
- Purchases: Yes, Apple in-app purchases (consumable coin packs)
- Game Center: Yes (leaderboard)
- Account/login of our own: No

Re-evaluate every declaration if an SDK or network feature is added
(rewarded ads in #66 and the Supabase leaderboard in #63 both change it).

## Google Play copy (draft, not yet submitted)

Android does not yet have Google Play Billing or Play Games (#51), so the Play
listing must not mention coin packs or a leaderboard until they ship there.

Short description (79 characters):

> Outrun the deadly echoes created by every route you complete.

Full description: reuse the Apple description above, minus the Game Center and
coin-pack lines, until Android reaches feature parity.

- Google Play Data Safety: to be completed at #51 (ads from day one per #66 change it)
