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

Prereqs to run `claude-setup.sh`: `git`, `jq`. For the agent tooling itself once
set up: `bun`, `gh`, `python3` (used by the rule hook), plus the external
**graphify** CLI (see below). Tip: in a Claude Code session you can run a command
yourself by typing `! <command>` at the prompt.

## What reproduces automatically (no script)

`.claude/settings.json` is committed and declares both the marketplaces and the
plugins to enable. The first time you open this project in Claude Code and trust
it, Claude Code installs them, along with the MCP servers those plugins bundle.
`.mcp.json` declares one more MCP server, `sqlite`.

- **Marketplaces** (`extraKnownMarketplaces`): `claude-plugins-official`
  (anthropics/claude-plugins-official), `svelte` (sveltejs/ai-tools),
  `impeccable` (pbakaus/impeccable), `ui-ux-pro-max-skill`
  (nextlevelbuilder/ui-ux-pro-max-skill).
- **Plugins** (`enabledPlugins`): the Bun/Svelte/testing/review/UI/git/CI/meta
  set — superpowers, svelte, github, playwright, chrome-devtools-mcp, context7,
  code-review, code-simplifier, pr-review-toolkit, commit-commands,
  feature-dev, claude-md-management, frontend-design, impeccable, ui-ux-pro-max,
  hookify, plugin-dev, skill-creator, typescript-lsp, security-guidance.
- **MCP servers**:
  - bundled in those plugins: github, svelte, playwright, chrome-devtools, context7;
  - declared in `.mcp.json` (`mcpServers`): `sqlite`, which runs
    `npx -y mcp-server-sqlite-npx@0.8.0 ./local.db`.
- **Hooks** (`hooks`):
  - `PreToolUse` (every tool) → `.claude/rule-hook/hook.py` — checks the call
    against the rules in `.claude/rule-hook/rules/*.md`. A matching `block` rule
    denies the call and its message becomes the tool error the agent reads; a
    `warn` rule lets the call go on, adds its message to the agent's context and
    shows it to you.
    The rule files keep hookify's format, and the hook copies hookify 0.1.1's
    engine (Apache-2.0, `.claude/rule-hook/LICENSE`); hookify itself puts these
    messages where the agent never reads them (#663). Needs `python3`, standard
    library only.
  - `SessionStart` (startup|resume) → `scripts/session-bootstrap.sh` — on Claude
    cloud only (`CLAUDE_CODE_REMOTE`), runs `bun install` so a fresh clone has its
    deps; a no-op locally.
- **Project skills & agents** (committed, project-local — distinct from the standalone
  skills the setup script installs):
  - `.claude/skills/create-migration/` — create a Drizzle schema migration: generate
    it from `schema.ts`, review the SQL, apply it and verify the backup.
  - `.claude/skills/fallow/` — fallow codebase analysis: unused code, duplication,
    circular dependencies, complexity, architecture boundaries.
  - `.claude/skills/i18n-add-key/` — add a UI message key to both `messages/en.json`
    and `messages/fr.json`, then check parity.
  - `.claude/skills/pre-launch-check/` — run the release-readiness gate (the checks
    CI enforces) and report go/no-go.
  - `.claude/agents/tenant-isolation-auditor.md` — audits data-access code for
    cross-household or cross-child leaks.
  - `.claude/agents/webauthn-auth-reviewer.md` — reviews the in-house WebAuthn
    passkey, Argon2id and session code for auth pitfalls.

Hooks and skills from your own user-level Claude Code config also run on your
machine; they do not come from this repo, so a fresh clone or a cloud session
does not get them.

**Deliberately excluded** (off-topic for diversif, which is SQLite + self-hosted
on Coolify/Komodo, no Cloudflare/Discord/Sentry): the `cloudflare`, `discord`,
`sentry`/`sentry-skills`, and `context-mode` plugins. Re-enable any of them in a
machine-local `settings.local.json` if you ever need them.

## What the script restores

`scripts/claude-setup.sh` handles the pieces Claude Code can't auto-install:

1. **Standalone agent skills** — the 19 skills in `.claude/skills.manifest.json`
   (bun, sveltekit-structure, i18n, testing, docker, ci, perf, git/PR helpers,
   …). These aren't from a Claude marketplace; the script reproduces each by
   sparse-cloning its source repo and copying the skill folder into
   `~/.claude/skills/`. Curated subset of `~/.agents/.skill-lock.json`;
   Postgres-only skills were dropped (diversif is SQLite/Drizzle).
   - `--force` refreshes existing skills; `--dry-run` previews.
2. **`settings.local.json`** — copies the committed
   `settings.local.json.example` to `settings.local.json` if missing, so you can
   add any machine-local permissions/env.

## Secrets — important

`.claude/settings.local.json` is **gitignored at the repo level** (see
`.gitignore`) and holds only machine-local permissions/env — keep any future
secrets there, never in a committed file. GitHub access uses the **`gh` CLI**
(`gh auth login`), so no personal access token is needed.

## External prerequisite: graphify

The `/graphify` skill and the `graphify` CLI (codebase knowledge graph, output
committed under `graphify-out/`) are an external tool, not a marketplace plugin.
Install graphify separately; it provides both the CLI and its own skill. See the
graphify section in the project `AGENTS.md`.

## Claude Code on the web (cloud)

A cloud session starts from a **fresh clone** — committed config carries, your
machine's `~/.claude` does not (cloud is project-only, no persistent user config).
For diversif:

**Reproduces automatically** (committed → part of the clone):

- the 20 plugins + 4 marketplaces — installed at session start, **provided the
  environment's network access is Trusted/Custom** (not None);
- every hook in `.claude/settings.json`, the rule hook's rules (`.claude/rule-hook/rules/`),
  the project skills (`create-migration`, `fallow`, `i18n-add-key`, `pre-launch-check`)
  and the `tenant-isolation-auditor` and `webauthn-auth-reviewer` agents;
- `bun install` runs automatically via the committed `SessionStart` hook
  (`scripts/session-bootstrap.sh`, gated on `CLAUDE_CODE_REMOTE`).

**Needs one web-UI step** — point the environment's **Setup Script** field at:

```
scripts/cloud-setup.sh
```

It runs once before launch (and is cached) to install the things that can't be
committed: the standalone skills (`scripts/claude-setup.sh`) and the `gh` CLI
(the cloud image lacks it).

**Still manual:** the external **graphify** CLI has no public installer — install
it yourself if you want `/graphify` queries. The committed `graphify-out/` is
readable without it.

**Secrets:** there's no `settings.local.json` in cloud (gitignored). Supply any
secrets as **environment variables** in the cloud environment UI. GitHub git
access is handled by Anthropic's proxy — no token needed.

## Updating the setup

- **Add/remove a plugin or marketplace:** edit `.claude/settings.json`.
- **Add/remove a standalone skill:** edit `.claude/skills.manifest.json`, then
  re-run `scripts/claude-setup.sh` (`--force` to refresh).
- **Add/change a hook:** edit `.claude/settings.json` (shared) or the script
  its entry runs (`.claude/rule-hook/hook.py`, `scripts/session-bootstrap.sh`);
  add or change a rule in `.claude/rule-hook/rules/`; keep machine-local-only
  hooks in `settings.local.json`.
- **Any of these changes:** `scripts/claude-setup-doc.test.ts` checks this
  doc's Hooks list, its project skills and agents lists and its MCP lines
  against `.claude/settings.json`, `.claude/skills/`, `.claude/agents/` and
  `.mcp.json`, so `bun run test` goes red until the doc follows the change.
