# Reproducible Claude Code setup — design

**Date:** 2026-06-08
**Goal:** Commit the useful Claude Code skills, hooks, MCP servers, and plugins
into the diversif repo so the agent setup reproduces on any machine.

## Decisions (confirmed with owner)

- **Mechanism: hybrid.** Reference upstream plugins/skills (auto-install or
  re-install from source); vendor only the genuinely custom/local artifacts.
  Rationale: small diff, stays current, no third-party-code/licensing bloat,
  while custom bits stay self-contained.
- **Scope: curated to diversif's stack** (Bun + SvelteKit + SQLite/Drizzle +
  WebAuthn, French UI, self-hosted on Coolify/Komodo, Playwright E2E). Drop
  off-topic plugins (cloudflare, discord, sentry) and Postgres-only skills.
- **Standalone skills: reproduce from source** via a setup script reading a
  committed manifest (not vendored).
- **Bootstrap: SETUP doc + install script.**

## Inventory (as discovered)

- MCP servers: none configured standalone — all are bundled inside plugins
  (github, svelte, playwright, chrome-devtools, context7). Reproducing the
  plugins reproduces the MCPs. claude.ai account connectors (Gmail/Drive/PayPal/
  Sentry/Canva/Cloudflare) are account-level, out of scope.
- Plugins: 4 marketplaces → 21 kept plugins after curation.
- Standalone skills: 24 under `~/.agents/skills` (managed by
  `~/.agents/.skill-lock.json`) → 20 kept (4 Postgres-only dropped).
- Already committed: `.claude/hooks/code-review-on-push.sh`, 3 hookify rules,
  graphify `PreToolUse` hook in `.claude/settings.json`, `graphify-out/`.

## Deliverables

1. **`.claude/settings.json`** (rewrite) — add `extraKnownMarketplaces` (4) so a
   fresh clone can actually auto-install; curated `enabledPlugins` (21); keep the
   graphify `PreToolUse` hook; **promote** the `code-review-on-push`
   `PostToolUse` hook from the gitignored local file so it reproduces. Prior file
   listed plugins but declared no marketplaces — reproduction was broken.
2. **`.claude/settings.local.json.example`** — sanitized template: PAT
   placeholder + cleaned `permissions.allow` (drop dead Elixir/Phoenix/Postgres
   rules from the abandoned Phoenix rewrite; add Bun rules).
3. **`.gitignore`** — add `.claude/settings.local.json` at repo level
   (previously protected only by the machine-global gitignore).
4. **`.claude/skills.manifest.json`** — 20 curated skills with `{name, repo,
skillPath}`.
5. **`scripts/claude-setup.sh`** — idempotent bootstrap: seed local settings,
   install standalone skills via sparse git clone into `~/.claude/skills/`.
6. **`docs/claude-setup.md`** — what auto-reproduces vs script; prereqs (bun, jq,
   gh, external graphify CLI); secrets/PAT rotation note.

## Local (uncommitted) cleanup

- Remove the now-duplicated `PostToolUse` hook from the owner's machine-local
  `.claude/settings.local.json` to avoid double-firing `/code-review`.

## Security

`.claude/settings.local.json` carries a plaintext GitHub PAT. Never committed
(was only globally gitignored; now repo-gitignored too). Rotate the token.

## Verification

JSON validity (`jq`) on both settings files + manifest; `bash -n` on the script;
sparse-checkout smoke test against a deep-path skill (warpdotdev council);
confirm no secret is staged for commit.
