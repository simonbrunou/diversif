---
name: block-e2e-start-without-slot
enabled: true
event: bash
action: block
conditions:
  - field: command
    operator: regex_match
    pattern: (^|[;&|(]|\n)\s*fj\s+pr\s+(-R\s+\S+\s+)?(create|merge)\b|(diversif|\$API)/actions/(jobs|runs)/[^/\s]+/rerun
  - field: command
    operator: not_contains
    pattern: wait-e2e-slot.sh
---

🚫 **This command starts a CI E2E job: run it behind the slot check**

AGENTS.md, « Before you start a CI E2E job »: opening a PR, merging one and rerunning a job or a run each start an `End-to-end tests (Playwright)` job on the shared runner. Run the same command as `scripts/wait-e2e-slot.sh && <command>` in one foreground Bash call with `timeout: 600000`, and run it again on exit 3. Two E2E jobs side by side time each other out: on 2026-11-02 the #628 merge, made without it, started run 430's E2E job beside run 428's.

This rule sees `fj pr [-R <remote>] create|merge` and a `…/diversif/actions/(jobs|runs)/<id>/rerun` or `$API/actions/…/rerun` call. A PR in another repo's clone goes through `fj pr -C <clone> …`, which it lets through. A `git push` to an open PR's branch also starts an E2E job, and stays your call: push it behind the same check.
