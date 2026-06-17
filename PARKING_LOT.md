# Parking lot

Things deliberately deferred during the pre-launch hardening pass (see the
checklist in the project notes). Parked ≠ rejected — these are revisited only if
real usage proves them necessary, or as explicit post-launch work.

## Email verification / transactional mail sender

**Deferred 2026-06-04.** Diversif has no mail sender at all (no SMTP/Resend/etc.,
no `emailVerified` column, no verification token). Standing one up is a sizable
piece of infrastructure (provider, deliverability, templates, a verify flow, and
the account-recovery surface it implies).

Decision: **defer.** Signup stays open for now; the abuse exposure is instead
bounded by rate limits plus the per-account creation caps tracked in the P1
"abuse & limits" work. Revisit if/when: (a) we want verified-email account
recovery, (b) open signup proves abusable in practice, or (c) we switch to
requiring email confirmation. Until a sender exists, email verification is not
buildable.

## Off-box backup scheduling (Litestream → R2)

**Carried over 2026-06-17** from the removed `TOOLING_AUDIT.md` (item B1). The
pre-deploy `VACUUM INTO` snapshot + `bun run db:verify-backup` method is documented
in `DEPLOY.md`, but a _scheduled_ off-box / continuous backup is not yet configured.
The single-file SQLite DB holds other families' data, so this matters before a
fully-open launch.

Recommended: **Litestream → R2** for continuous streaming replication — WAL mode is
already enabled (its prerequisite), giving point-in-time recovery with seconds of
RPO vs. up to 24h for daily snapshots, and needs no app changes. Keep the documented
`VACUUM INTO` pre-deploy snapshot as belt-and-braces. ⚠️ Backups taken _before_ the
session-token-hashing migration contain raw session tokens — handle as a secrets
file until they age out (also noted in `DEPLOY.md`).

## Explicitly out of scope for the hardening pass

Carried over from the checklist's parking lot — do not start these during
hardening:

- Real-time multi-user live sync (current "shows up when I open the app" is enough).
- Any framework/stack change.
- New tracking features, analytics dashboards, growth features.
