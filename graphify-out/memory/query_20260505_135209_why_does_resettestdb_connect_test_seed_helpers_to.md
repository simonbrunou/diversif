---
type: "query"
date: "2026-05-05T13:52:09.800731+00:00"
question: "Why does resetTestDb connect Test Seed Helpers to Passkey, Hooks Auth Tests, Dashboard Data Loaders, GDPR Data Export, Cleanup Rate Limiting, and Database Backup Migrations?"
contributor: "graphify"
source_nodes: ["resetTestDb", "db_index_getDb"]
---

# Q: Why does resetTestDb connect Test Seed Helpers to Passkey, Hooks Auth Tests, Dashboard Data Loaders, GDPR Data Export, Cleanup Rate Limiting, and Database Backup Migrations?

## Answer

resetTestDb() in src/test/db.ts:32 deletes from all 10 tables in FK-respecting order. Every server-side feature group's test calls it in beforeEach, so it bridges every community whose tables it touches: tip_dismissals/food_entries (Dashboard), webauthn_challenges/passkeys (Passkey), sessions/users (Auth, GDPR, Cleanup), foods (DB Backup). The src/test/db.ts file also mirrors src/lib/server/db/index.ts's foreign_keys=OFF→migrate→foreign_key_check→ON dance, coupling tests to the migration safety invariant — that's why community 19 (DB Backup) shows up too. The DELETE list is hand-maintained; adding a table without updating resetTestDb() would silently leak rows across tests.

## Source Nodes

- resetTestDb
- db_index_getDb