#!/usr/bin/env bash
# PostToolUse(Write|Edit): format the just-edited file with Prettier.
# prettier-plugin-svelte is auto-loaded from the prettier config, so .svelte
# files are covered. Bun-native repo, so prefer the local binary, then bunx.
FILE=$(python3 -c "import json,sys; print(json.load(sys.stdin).get('tool_input',{}).get('file_path',''))" 2>/dev/null)
[ -z "$FILE" ] && exit 0
case "$FILE" in
  *.svelte | *.ts | *.js | *.mjs | *.json | *.css | *.html | *.md) ;;
  *) exit 0 ;;
esac
[ -f "$FILE" ] || exit 0

ROOT="${CLAUDE_PROJECT_DIR:-.}"
# Prefer the project's local Prettier; fall back to bunx, then npx.
if [ -x "$ROOT/node_modules/.bin/prettier" ]; then
  "$ROOT/node_modules/.bin/prettier" --write --log-level warn "$FILE" >/dev/null 2>&1
elif command -v bunx >/dev/null 2>&1; then
  bunx prettier --write --log-level warn "$FILE" >/dev/null 2>&1
elif command -v npx >/dev/null 2>&1; then
  npx --no-install prettier --write --log-level warn "$FILE" >/dev/null 2>&1
fi
exit 0
