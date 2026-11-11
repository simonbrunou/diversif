---
# scripts/rule-hook.test.ts runs this rule through .claude/rule-hook/hook.py over the commands it blocks and lets through. Give it a case for each form an edit changes. It reads `pkill`, `killall`, `fuser` with a `-…k` option, and a command that holds both `pgrep` and `kill`. Other ways to find a PID (`ss -p`, `lsof -t`, a `kill-port` tool) get through.
name: block-kill-by-name
enabled: true
event: bash
action: block
conditions:
  - field: command
    operator: regex_match
    pattern: \b(pkill|killall)\b|\bpgrep\b[\s\S]*\bkill\b|\bkill\b[\s\S]*\bpgrep\b|\bfuser\b[^;&|\n]*\s-[a-z]*k
  - field: command
    operator: not_contains
    pattern: # no-kill-by-name
---

🚫 **Stop the process you started by its PID**

A name or a port matches the processes of every worktree on the host. `pkill -f 'bun build/index.js'` also stops the server of another worktree's E2E run (Playwright's `webServer` runs `bun build/index.js`), and the Bash call whose own command line holds the pattern (exit 144). `fuser -k 4173/tcp` stops whatever another worktree serves on that port.

Save the PID when you start a server, and kill that PID. « Reproducing a bug on a production build » in `docs/agents/testing.md` shows how.

When this command stops nothing by name or by port (a search, a commit message that names `pkill`, a `pgrep` check next to a `kill` of a PID you saved), add a `# no-kill-by-name` comment to it.
