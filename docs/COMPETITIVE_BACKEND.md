# Competitive backend architecture

This branch moves Echo Steps toward a worldwide competitive game without trusting the mobile client.

## Implemented foundation

- Guest/offline gameplay remains the default and requires no account.
- Signed-in cloud builds can create server-owned ranked run IDs.
- Each cleared round is checkpointed sequentially. The client never writes a leaderboard row or arbitrary score.
- Finished leaderboard scores come only from the server's verified checkpoint count.
- Duplicate active sessions, non-sequential checkpoints, implausibly fast checkpoints, stale sessions, and replayed finishes are rejected.
- Worldwide, daily, weekly, and monthly-season leaderboard queries are available.
- Public player profiles are separated from private account identity.
- Wallet ledger, entitlements, and store transaction tables are server-owned. Authenticated clients have no direct mutation privileges.
- Store transaction IDs are unique by provider, providing the idempotency anchor required for purchase verification.

## Security boundary

The mobile app is assumed hostile. A modified app can call public APIs, inspect its own token, and alter local memory. It therefore cannot directly insert ranked runs, set verified round counts, mint currency, grant entitlements, or create verified store transactions.

Checkpoint validation raises the cost of score forgery but is not proof of genuine gameplay by itself. Before public ranked launch, add telemetry-based run validation and abuse scoring for high-value ranks, rate limits at the edge, and administrative quarantine/review tooling. Never advertise the leaderboard as cheat-proof.

## Purchase release gate

No paid products are enabled by this change. Before selling anything:

1. Configure products in App Store Connect and Google Play Console.
2. Implement StoreKit 2 / Play Billing clients.
3. Send store transaction evidence to a trusted backend function.
4. Verify directly with Apple/Google server APIs.
5. Insert the provider transaction ID exactly once.
6. Grant the entitlement or ledger credit in the same idempotent server operation.
7. Process refunds, revocations, chargebacks, restores, and reconciliation.
8. Sandbox-test duplicate/replayed evidence and account switching.

The client must never grant permanent value from a local purchase-success callback.

## Identity

Email OTP remains the currently implemented recovery identity and is disabled in default builds. Native Apple/Game Center and Google Play Games sign-in should be added only with the official developer-console configuration and real bundle/application credentials. Do not ship placeholder OAuth client IDs or secrets.

## Activation

Competitive/account services remain behind the existing cloud activation build gate. Staging must pass RLS tests, deletion tests, two-device sync, ranked abuse tests, and privacy/store disclosure review before production activation.
