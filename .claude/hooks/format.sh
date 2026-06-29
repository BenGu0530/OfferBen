#!/usr/bin/env bash
# PostToolUse hook: auto-format the file Claude just edited, so both
# contributors' code stays consistently styled without anyone remembering.
# Reads the hook JSON on stdin; formats only source files; never fails the edit.
input=$(cat)
file=$(printf '%s' "$input" | python3 -c "import sys,json;print(json.load(sys.stdin).get('tool_input',{}).get('file_path',''))" 2>/dev/null)
[ -z "$file" ] && exit 0
case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.css|*.json|*.md) ;;
  *) exit 0 ;;
esac
[ -f "$file" ] || exit 0
# --no-install: stay silent if prettier isn't installed yet; never block the edit.
npx --no-install prettier --write "$file" >/dev/null 2>&1 || true
exit 0
