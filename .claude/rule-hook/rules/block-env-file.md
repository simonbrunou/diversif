---
# No tool_matcher, unlike the other file rules: this one denies every tool whose file_path names a real .env file, a Read included. scripts/rule-hook.test.ts pins both (#719).
name: block-env-file
enabled: true
event: file
action: block
conditions:
  - field: file_path
    operator: regex_match
    pattern: (^|/)\.env$|(^|/)\.env\.(local|development|production|test)$
---

🚫 **Don't read, edit or publish a real `.env` file**

`.env`, `.env.local`, `.env.development`, `.env.production` and `.env.test` hold
secrets, such as `SENTRY_AUTH_TOKEN` and the Sentry DSN. A read or an edit puts
their values in the session's context and transcript, and a publish puts them on
a page. git ignores these files, so an edit changes only your machine.

The rule reads the `file_path` of any tool, so it denies a Read, an Edit, a Write
or an Artifact publish of these files. It cannot see a Bash command or a Grep
`path`: don't read them that way either.

**Allowed:** `.env.example`, the template with no secrets, passes for every tool.
Edit it to document a new variable. Then copy it to `.env` and fill in the real
values **yourself**, outside Claude.
