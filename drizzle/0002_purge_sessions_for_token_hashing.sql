-- Sessions are now stored hashed at rest: the cookie keeps the raw 256-bit
-- token, sessions.id holds sha256(token) hex (src/lib/server/auth.ts).
-- Existing rows contain RAW tokens, which can never match a hashed lookup
-- again — they are dead weight that still works as live bearer tokens for
-- anyone holding an old copy of the database file. Drop them all: every
-- signed-in user simply re-authenticates once (pre-launch, acceptable).
-- Idempotent by construction; no schema change, so no snapshot diff.
DELETE FROM `sessions`;
