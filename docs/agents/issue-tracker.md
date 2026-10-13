# Issue tracker: Forgejo

Issues and specs for this repo live as issues on the self-hosted Forgejo at https://git.sbrn.eu/simonbrunou/diversif (the `origin` remote). Use the `fj` CLI (forgejo-cli) for every operation, with `-R origin` from inside the clone.

The `github` remote is a push mirror. Never open, edit or comment on issues there.

## Conventions

- **Create an issue**: `fj issue create -R origin "<title>" --body-file <file>`. Write multi-line bodies to a temp file first; `--body "..."` is fine for one line. Omitting both opens an editor, so always pass one. `fj issue create` cannot set labels: apply them right after (see below).
- **Read an issue**: `fj issue view -R origin <number>` for title and body, `fj issue view -R origin <number> comments` for the thread.
- **List / search issues**: `fj issue search -R origin [query] --state open --labels <label>`. `--state` takes `open`, `closed` or `all`.
- **Make an issue a child of a parent**: Forgejo has no sub-issues. Put `Part of #<parent>` at the top of the child body, and list the children as a task list in the parent body.
- **Comment on an issue**: `fj issue comment -R origin <number> "<body>"`
- **Apply / remove labels**: `fj issue edit -R origin <number> labels --add <label>` / `--rm <label>`
- **Edit the body**: `fj issue edit -R origin <number> body "<new body>"`
- **Assign**: `fj issue assign -R origin <number> simonbrunou`
- **Close**: `fj issue close -R origin <number> --with-msg "<comment>"`
- **Create a missing label**: `fj repo labels simonbrunou/diversif create <name> <hex-color> -d "<description>"`

Issues and pull requests share one number space on Forgejo, so a bare `#42` may be either: resolve with `fj pr -R origin view 42` and fall back to `fj issue view -R origin 42`. Note that `fj pr` takes `-R` before its subcommand, unlike `fj issue view`.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using `fj pr -R origin view <n>` (with `comments` / `diff` subcommands), `fj pr -R origin search`, and the equivalent comment, label and close operations.

## When a skill says "publish to the issue tracker"

Create a Forgejo issue as in **Create an issue** above, then apply its labels.

## When a skill says "fetch the relevant ticket"

Read it as in **Read an issue** above, including the comments.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. Create the label on first use (see **Create a missing label**).
- **Child ticket**: an issue with `Part of #<map>` at the top of its body, listed in the map's task list. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`), created on first use. Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: a `Blocked by: #<n>, #<n>` line at the top of the child body. Forgejo has native issue dependencies in its web UI, but `fj` cannot manage them, so the body line is canonical. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the map's open children (`fj issue search -R origin --state open --labels wayfinder:<type>`, scoped to the map's task list), drop any with an open blocker or an assignee; first in map order wins.
- **Claim**: `fj issue assign -R origin <n> simonbrunou`, the session's first write.
- **Resolve**: `fj issue comment -R origin <n> "<answer>"`, then `fj issue close -R origin <n>`, then append a context pointer (gist + link) to the map's Decisions-so-far with `fj issue edit -R origin <map> body`.
