# Echo Steps store preparation packet

Status: reviewable draft. Not submitted; no real-device or signing claim.

## Listing copy

**Store name:** Echo Steps: Ghost Run (App Store Connect record); home-screen name: Echo Steps

**Short description:** Collect the prize. Reach the exit. Survive your own echoes.

**Description:** Every route leaves an echo behind. Collect the prize and reach
the exit, then face the paths you created in earlier rounds. Watch the moving
obstacles, use short-lived bonuses, and survive until the Garbage Collector
clears old echoes. Fast touch controls and offline play keep each run simple to
start and challenging to master.

Ranked competition, cloud recovery, rewarded ads and paid purchases must not be
advertised in the listing until they are actually enabled and accepted in the
submitted binary. The current release default remains offline guest play.

## Evidence and owner gates

| Item | Current evidence or required action |
|---|---|
| Web/native automated tests | Required exact-head CI; inspect final artifacts |
| Android signing | CI AAB is unsigned; requires the owner's upload key/Play setup |
| iOS signing | Simulator builds only; requires Developer Team and device archive |
| Device acceptance | Airplane mode, first launch, 30 rounds, interruptions, save/reinstall |
| Native token vault | Keychain/Keystore tests on physical iOS/Android; failures stay closed |
| Account providers | Apple/Google configuration and approved callback/capability settings |
| Support/privacy | Owner must confirm durable contact, retention and final declarations |
| Identity | Confirm Echo Steps branding and permanent `com.mukulkatari.echosteps` ID |
| Screenshots | Capture the accepted build on actual store target sizes |
| Google testing | Confirm account-specific testing requirements in Play Console |
| Submission | Owner approval required by WORKFLOW.md; no automatic submission |

## Screenshot capture brief

Use the accepted binary: opening screen, prize/exit route, visible ghost trails,
a Garbage Collector sweep and the end-of-run screen. Preserve readable controls
and accurate gameplay. No fabricated leaderboard, purchase UI or score claims.
Screenshots and App Preview footage must reflect the exact submitted feature set.

## Release sequence

Prepare signed development builds, install through internal Play testing and
TestFlight, record device acceptance, approve disclosures/listing, upload signed
store builds, and submit only after owner approval. Increase build numbers for
new uploads. Keep the prior artifacts and deployment revision for rollback.
