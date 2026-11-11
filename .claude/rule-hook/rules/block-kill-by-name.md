---
# scripts/rule-hook.test.ts runs this rule through .claude/rule-hook/hook.py over the commands it blocks and lets through. Give it a case for each form an edit changes.
name: block-kill-by-name
enabled: true
event: bash
action: block
conditions:
  - field: command
    operator: regex_match
    pattern: \b(pkill|killall)\b
  - field: command
    operator: not_contains
    pattern: # no-kill-by-name
---

🚫 **Stop the process you started by its PID**

A name matches every process of that name on the host, whichever worktree started it. `pkill -f 'bun build/index.js'` also stops the server that another worktree's E2E run or production-build repro is using (Playwright's `webServer` runs `bun build/index.js`), and the Bash call whose own command line holds the pattern (exit 144). Three threads ran it (#622, #713, #722).

Keep the PID when you start the server, and stop that PID:

```sh
nix develop -c env PORT=<port> DATABASE_PATH=<db> bun build/index.js > <log> 2>&1 & echo $! > <pid file>
kill "$(cat <pid file>)"
```

`nix develop -c` execs bun, so `$!` is the server's own PID. Take a port of your own, as « E2E from a worktree: give the run a free port » in `docs/agents/testing.md` says.

When this command stops nothing by name (a search, or a commit message that names `pkill`), add a `# no-kill-by-name` comment to it.
