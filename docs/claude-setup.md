# Claude Code setup — reproducible everywhere

This repo carries its Claude Code tooling (plugins, MCP servers, hooks, skills)
so the same agent setup reproduces on any machine. There are **two** parts:
what Claude Code restores automatically, and what one script restores.

## TL;DR

```bash
# On a fresh machine, after cloning:
scripts/claude-setup.sh         # installs standalone skills, seeds local settings
# then open the project in Claude Code and trust it → plugins + MCPs auto-install
```

Prereqs on PATH: `git`, `jq`, `bun`, `gh`. Plus the external **graphify** CLI
(see below). Tip: in a Claude Code session you can run a command yourself by
typing `! <command>` at the prompt.

## What reproduces automatically (no script)

`.claude/settings.json` is committed and declares both the marketplaces and the
plugins to enable. The first time you open this project in Claude Code and trust
it, Claude Code installs them — and because every MCP server we use is **bundled
inside a plugin**, installing the plugins also restores the MCP servers.

- **Marketplaces** (`extraKnownMarketplaces`): `claude-plugins-official`
  (anthropics/claude-plugins-official), `svelte` (sveltejs/ai-tools),
  `impeccable` (pbakaus/impeccable), `ui-ux-pro-max-skill`
  (nextlevelbuilder/ui-ux-pro-max-skill).
- **Plugins** (`enabledPlugins`): the Bun/Svelte/testing/review/UI/git/CI/meta
  set — superpowers, svelte, github, playwright, chrome-devtools-mcp, context7,
  code-review, code-simplifier, pr-review-toolkit, coderabbit, commit-commands,
  feature-dev, claude-md-management, frontend-design, impeccable, ui-ux-pro-max,
  hookify, plugin-dev, skill-creator, typescript-lsp, security-guidance.
- **MCP servers** (bundled in those plugins): github, svelte, playwright,
  chrome-devtools, context7.
- **Hooks** (`hooks`):
  - `PreToolUse` (Bash) — graphify: nudges Claude to read `graphify-out/` before
    grepping raw files.
  - `PostToolUse` (Bash) → `.claude/hooks/code-review-on-push.sh` — after a
    `git push` on a branch with an open PR, auto-triggers `/code-review`.
    Needs `gh` + `jq`; exits cleanly when neither a PR nor `gh` is present.

**Deliberately excluded** (off-topic for diversif, which is SQLite + self-hosted
on Coolify/Komodo, no Cloudflare/Discord/Sentry): the `cloudflare`, `discord`,
`sentry`/`sentry-skills`, and `context-mode` plugins. Re-enable any of them in a
machine-local `settings.local.json` if you ever need them.

## What the script restores

`scripts/claude-setup.sh` handles the pieces Claude Code can't auto-install:

1. **Standalone agent skills** — the 20 skills in `.claude/skills.manifest.json`
   (bun, sveltekit-structure, i18n, testing, docker, ci, perf, git/PR helpers,
   …). These aren't from a Claude marketplace; the script reproduces each by
   sparse-cloning its source repo and copying the skill folder into
   `~/.claude/skills/`. Curated subset of `~/.agents/.skill-lock.json`;
   Postgres-only skills were dropped (diversif is SQLite/Drizzle).
   - `--force` refreshes existing skills; `--dry-run` previews.
2. **`settings.local.json`** — copies the committed
   `settings.local.json.example` to `settings.local.json` if missing, so you can
   drop in your token and machine-local permissions.

## Secrets — important

`.claude/settings.local.json` holds your `GITHUB_PERSONAL_ACCESS_TOKEN` and is
**gitignored** (both repo-level and via the global ignore). Never commit it.
The committed template `settings.local.json.example` ships a `ghp_REPLACE_ME`
placeholder. If a real token ever sat in a plaintext file, rotate it.

## External prerequisite: graphify

The `/graphify` skill and the `graphify` CLI (codebase knowledge graph, output
committed under `graphify-out/`) are an external tool, not a marketplace plugin.
Install graphify separately; it provides both the CLI and its own skill. See the
graphify section in the project `CLAUDE.md`.

## Updating the setup

- **Add/remove a plugin or marketplace:** edit `.claude/settings.json`.
- **Add/remove a standalone skill:** edit `.claude/skills.manifest.json`, then
  re-run `scripts/claude-setup.sh` (`--force` to refresh).
- **Add/change a hook:** edit `.claude/settings.json` (shared) or
  `.claude/hooks/*.sh`; keep machine-local-only hooks in `settings.local.json`.
