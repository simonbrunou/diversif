#!/usr/bin/env bash
# PostToolUse(Bash) hook: after a successful `git push` on a branch
# with an open PR, inject a directive telling Claude to invoke
# /code-review before doing anything else.
#
# Wired in .claude/settings.local.json (gitignored). Personal, not team-wide.
# Requires: jq, gh (already declared in settings.local.json allow list).

set -u

PAYLOAD=$(cat)

# Extract the bash command that was run. Detect `git push` as a complete shell
# token anywhere in the command — handles compound forms like
# `git add . && git commit -m x && git push` that the settings.json `if` filter
# (prefix-only) misses.
CMD=$(printf '%s' "$PAYLOAD" | jq -r '.tool_input.command // empty' 2>/dev/null)
if ! [[ "$CMD" =~ (^|[^[:alnum:]_-])git[[:space:]]+push([[:space:]]|$) ]]; then
  exit 0
fi

# Skip dry runs — no remote update, no review needed.
case "$CMD" in
  *--dry-run*) exit 0 ;;
esac

# Skip pushes from main/master — those don't have a PR.
BRANCH=$(git branch --show-current 2>/dev/null || echo "")
case "$BRANCH" in
  ""|main|master) exit 0 ;;
esac

# Find an open PR for this branch. If none, nothing to review.
PR_NUM=$(gh pr view --json number,state 2>/dev/null \
  | jq -r 'select(.state == "OPEN") | .number' 2>/dev/null)
[ -z "$PR_NUM" ] && exit 0

# Tell Claude what to do next. `additionalContext` lands in the model's
# context before its next response, so the directive arrives synchronously.
jq -n --arg pr "$PR_NUM" '{
  systemMessage: ("PR #\($pr) pushed — auto-triggering /code-review"),
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: ("A git push just landed on PR #\($pr). You MUST invoke the /code-review skill now against this PR before any other action, per the user standing rule (\"run /code-review on every push to every PR\"). Do not skip it. Do not run any other command first.")
  }
}'
