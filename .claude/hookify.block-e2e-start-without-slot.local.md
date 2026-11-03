---
name: block-e2e-start-without-slot
enabled: true
event: bash
action: block
conditions:
  - field: command
    operator: regex_match
    pattern: ^(?![\s\S]*wait-e2e-slot\.sh(\s+("[^"]*"|'[^']*'|[^\s"'&;|]+))?\s+&&)[\s\S]*?(?:(^|[;&|(]|\n|\b(do|then|else|xargs))\s*(nix\s+develop\s+(\S+\s+)?(-c|--command)\s+)?fj\s+((-H|--host|--style)\s+\S+\s+)*pr\s+((-R|--remote)\s+\S+\s+)?(create|merge)\b|(diversif|\$\{?API\}?"?)/(actions/(jobs|runs)/[^/\s]+/rerun|pulls/[^/\s]+/merge))
  - field: command
    operator: not_contains
    pattern: # no-e2e-job
---

🚫 **This command can start a CI E2E job: put the slot check in front of it**

Opening a PR, merging one and rerunning the E2E job or a whole run each start an `End-to-end tests (Playwright)` job on the shared runner, and two side by side time each other out: on 2026-11-02 the #628 merge, made without the check, started run 430's E2E job beside run 428's. Run it as `scripts/wait-e2e-slot.sh && <command>`, or as `scripts/wait-e2e-slot.sh <sha> && <command>` when the command works on a branch other than the checked-out one, with the timeout and the exit-3 retry that AGENTS.md « Before you start a CI E2E job » gives.

The rule reads the command text only. When this command starts no E2E job (a rerun of another job, such as the unit job testing.md reruns after a runner cancel; an `$API` that points at another repo; a commit message, search or `--help` that quotes these words), add a `# no-e2e-job` comment to it. `fj pr -C <clone> …` passes, so keep it for a PR in another repo's clone. A `git push` to an open PR's branch, a PR opened through `POST $API/pulls` and a reopen through the API also start an E2E job, and stay your call.
