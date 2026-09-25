# Cloud account and economy implementation plan

Status: foundation proposal in `feature/backend-foundation`. The game still uses
device-local saves; this branch does not activate accounts, transmit player data,
or change the privacy policy. Do not connect a production client until the
privacy, deletion, recovery, and authorization gates below are complete.

## Decision record

- Use managed PostgreSQL plus managed identity; the first migration targets
  Supabase. It is not a purchase backend by itself.
- Allow guest/offline play. A player must explicitly sign in to enable cloud
  recovery. Never silently replace a local save with a remote save.
- `player_saves` contains only non-economic settings and a personal best. It
  accepts an expected revision and returns a conflict when another device
  already wrote a newer save. Best rounds only increase. The best round is
  unverified and must not become a competitive leaderboard entry.
- The eventual wallet and entitlements require a separate server-owned ledger.
  No direct client INSERT/UPDATE/DELETE privileges for purchases or balances.
- Do not commit production URLs with privileged keys, signing material, mail
  credentials, or store API credentials. The public project key is not a
  substitute for authorization or RLS.

## Phases and release gates

1. **Security foundation:** Create independent staging and production projects;
   apply reviewed migrations; enforce admin MFA and least privilege; record
   data retention and recovery targets; test backup restore. Exercise the
   cross-account SQL checks below. Do not use the free database as the sole
   durable production copy of players' data.
2. **Accounts and saves:** Implement verified sign-in and recovery, secure
   refresh-token storage on native devices, guest claim, logout/account switch,
   revisioned sync, and offline queue. Show sync status and a conflict resolution
   choice. Test two devices, reinstall, offline writes, mismatched schemas, lost
   connectivity, and deletion. Update privacy and store disclosures before
   collecting accounts. Keep local play available during backend outages.
3. **Server economy:** Define an append-only transaction ledger, idempotent
   earn/spend commands, reconciliation, alerts, and limits. A modified client
   must not be able to create balance or buy an item twice. Decide how offline
   earnings are verified before they are credited.
4. **Paid purchases:** Integrate native StoreKit and Play Billing. Verify store
   evidence on a trusted server before granting value. Record transaction IDs
   uniquely; handle pending, duplicate, refund/revocation, restored purchase,
   reconciliation, and outages. Test all flows in both stores' sandboxes and
   update privacy/store declarations.
5. **Operations:** Document on-call owner, redacted audit logs, budgets, abuse
   alarms, access reviews, key rotation, backup/restore rehearsal, and incident
   response. Release only after real-device and store acceptance.

## Manual security verification for the first migration

Run these checks in a **disposable** Supabase project after applying the
`cloud_saves` migration. Create two test accounts through Supabase Auth and use
their user JWTs to exercise PostgREST. Do not use service-role credentials for
the client checks; that role bypasses RLS.

| Caller | Request | Required result |
|---|---|---|
| Anonymous | GET `player_saves` | No rows; no write access. |
| Player A | RPC `put_player_save(0, {}, 3)` | Revision 1. |
| Player A | GET `player_saves` | Exactly A's row. |
| Player B | GET `player_saves` | Does not include A's row. |
| Player B | PATCH/DELETE A's row | Denied. |
| Player A | Direct PATCH own row | Denied; writes only through the RPC. |
| Player A | RPC `put_player_save(1, {}, 2)` | Revision 2, best stays 3. |
| Player A | RPC `put_player_save(1, {}, 4)` | Conflict; stored row unchanged. |
| Player A | RPC with `{"coins":999}` | Rejected, stored row unchanged. |
| Player A | RPC with >4 KB settings | Rejected. |
| No JWT | RPC | Denied. |

The `supabase/tests/001_player_saves.test.sql` pgTAP suite now runs in CI
against a disposable local database and gates the existing aggregate release
check. Repeat its authorization checks against a disposable hosted staging
project before production activation. Do not claim this migration is deployed
or production verified merely because local database and game tests pass.

## Account and purchase governance

- Collect only player ID, optional email, pseudonym, preferences, progress,
  required store transaction identifiers, and narrowly scoped audit metadata.
  Do not store card numbers, ID documents, or other sensitive data without a
  separate approved product purpose and threat model.
- Restrict credentials by environment and role. Keep privileged verification
  and reconciliation server-side. Redact email, auth tokens, store receipts,
  and transaction payloads in routine logs.
- Provide in-app account deletion initiation and an accessible web deletion
  route where required. Define retention and legal exceptions before launch.
- Choose recovery point/time targets with the owner. Managed daily backups
  have a larger data-loss window than point-in-time recovery; test restores.
- Review store product types before implementation: durable cosmetics are
  easier to restore than consumable coins. The game currently contains no paid
  products, so there is no transaction verification to deploy yet.

## Current next engineering PR

Build the account UI and sync adapter behind a disabled feature flag, plus
staging integration tests. Activate it only after production identity, mail,
deletion, policy, and recovery preparations are reviewed.
