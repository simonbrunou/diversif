---
name: block-env-edit
enabled: true
event: file
action: block
conditions:
  - field: file_path
    operator: regex_match
    pattern: (^|/)\.env$|(^|/)\.env\.(local|development|production|test)$
---

🚫 **Don't edit real `.env` files**

`.env` (and `.env.local` / `.env.production` / …) hold secrets — `DATABASE_PATH`,
Sentry DSN, WebAuthn RP config, etc. Claude editing them risks leaking secrets into
context, logs, or a commit. They're also not tracked, so an edit only changes your
local box.

**Allowed:** `.env.example` (the documented, secret-free template) is NOT blocked —
edit it to document a new variable. Then you copy it to `.env` and fill real values
**yourself**, outside Claude.
