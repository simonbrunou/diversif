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

## Explicitly out of scope for the hardening pass

Carried over from the checklist's parking lot — do not start these during
hardening:

- Real-time multi-user live sync (current "shows up when I open the app" is enough).
- Any framework/stack change.
- New tracking features, analytics dashboards, growth features.
