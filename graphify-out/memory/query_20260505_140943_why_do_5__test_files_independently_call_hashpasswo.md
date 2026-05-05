---
type: "query"
date: "2026-05-05T14:09:43.529590+00:00"
question: "Why do 5+ test files independently call hashPassword from lib/server/auth.ts?"
contributor: "graphify"
source_nodes: ["hashPassword", "seedUser_route"]
---

# Q: Why do 5+ test files independently call hashPassword from lib/server/auth.ts?

## Answer

Eight test files follow the same 2-step pattern: hashPassword(somePassword) then seedUser({ passwordHash }). Six of them don't need a real argon2id hash — they only need a user row to exist for session/passkey/logout tests, where seedUser's default passwordHash='placeholder-hash' would suffice. Only login/page.server.test.ts and account/page.server.test.ts genuinely exercise the password and need the real hash. Recommendation: drop hashPassword from the 6 tests that don't test passwords, add seedUserWithPassword(pw) helper to src/test/route.ts for the 2 that do. The graph caught this via a fan-out pattern: 5 distinct seedUser-style helpers in tests all --calls--> the same hashPassword node, INFERRED across communities — invisible at the file level.

## Source Nodes

- hashPassword
- seedUser_route