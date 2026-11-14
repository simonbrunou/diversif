---
# scripts/rule-hook.test.ts runs this rule through .claude/rule-hook/hook.py over the commands it blocks and lets through. Give it a case for each form an edit changes. It reads `pkill`, `killall`, `fuser` with a `--kill` option or a `-…k` one (a lower-case k, so `-SIGKILL` alone passes), also after a `\` line break, and a command that holds both `pgrep` and `kill`. A `kill` before the `pgrep` counts up to the next `;` or bare newline, or, inside a `$(` that opens before them, up to its first `)`. So `kill $(pgrep …)`, `kill $(cat x.pid || pgrep …)`, `kill $(cat x.pid; pgrep …)` and a `pgrep` on the line after `kill $(` block, while a `kill` of a saved PID ended by `;` or a newline, then a `pgrep` check, gets through. That `$(` may follow other closed `$(…)`, and a quoted `$(` counts too, so `rg -F 'kill $(' docs; pgrep -c vite` needs the escape comment. A `pgrep` after a nested `$(…)` closes inside the first `$(`, and one inside backticks after a `;` (``kill `cat x.pid; pgrep vite` ``), get through. The scan skips each closed `$(…)` whole, which keeps a long command of unclosed `$(` from backtracking past the hook's 10 s timeout. Other ways to find a PID (`pidof`, `ps | grep`, `ss -p`, `lsof -t`, a `kill-port` tool) get through.
name: block-kill-by-name
enabled: true
event: bash
action: block
conditions:
  - field: command
    operator: regex_match
    pattern: \b(pkill|killall)\b|\bpgrep\b[\s\S]*\bkill\b|\bkill\b(?:[^;\n]|\\\n)*\bpgrep\b|\bkill\b(?:[^;\n$]|\$(?!\()|\$\([^)]*\)|\\\n)*\$\([^)]*\bpgrep\b|\bfuser\b(?:[^;&|\n]|\\\n)*\s((?-i:-[a-zA-Z46]*k)|--kill\b)
  - field: command
    operator: not_contains
    pattern: # no-kill-by-name
---

🚫 **Stop the process you started by its PID**

A name or a port matches the processes of every worktree on the host. `pkill -f 'bun build/index.js'` also stops the server of another worktree's E2E run (Playwright's `webServer` runs `bun build/index.js`), and the Bash call whose own command line holds the pattern (exit 144). `fuser -k 4173/tcp` stops whatever another worktree serves on that port.

Save the PID when you start a server, and kill that PID. « Reproducing a bug on a production build » in `docs/agents/testing.md` shows how. A PID you look up by name or by port another way (`pidof`, `ps | grep`, `lsof -t`, `ss -p`) can belong to another worktree just the same.

When this command stops nothing by name or by port (a search, a commit message that names `pkill`, a `pgrep` check next to a `kill` of a PID you saved), add the exact comment `# no-kill-by-name` to it: lower case, one space after the `#`.
