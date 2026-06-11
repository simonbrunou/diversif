#!/usr/bin/env bash
# PostToolUse(Write|Edit): when a brainstorming SPEC or a writing-plans PLAN doc
# is written, nudge the agent to pressure-test it with the `council` skill
# (model-diverse subagents -> reconcile -> synthesize) before presenting it.
# Targets the superpowers brainstorming/writing-plans artifacts:
#   docs/superpowers/specs/*.md   (the spec / design doc)
#   docs/superpowers/plans/*.md   (the implementation plan)
# Requires: jq.
FILE=$(python3 -c "import json,sys; print(json.load(sys.stdin).get('tool_input',{}).get('file_path',''))" 2>/dev/null)
[ -z "$FILE" ] && exit 0

case "$FILE" in
  */docs/superpowers/specs/*.md | docs/superpowers/specs/*.md) KIND="spec" ;;
  */docs/superpowers/plans/*.md | docs/superpowers/plans/*.md) KIND="plan" ;;
  *) exit 0 ;;
esac

jq -n --arg kind "$KIND" --arg file "$FILE" '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: ("Council checkpoint: you just wrote a brainstorming \($kind) (\($file)). Before presenting this \($kind) to the user, convene the `council` skill to pressure-test it — model-diverse subagents investigate independently, then reconcile and synthesize — and fold the result into the \($kind). If a council pass is genuinely unwarranted (a trivial or mechanical \($kind)), add a \"Council review: n/a\" line to the doc and proceed.")
  }
}'
