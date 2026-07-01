#!/usr/bin/env bash
# PostToolUse hook: auto-format + lint-fix the file Claude just edited, so both
# contributors' code stays consistently styled AND free of dead imports / small
# correctness slips — without anyone remembering to run the tools.
# Reads the hook JSON on stdin; touches only source files; never fails the edit.
input=$(cat)
file=$(printf '%s' "$input" | python3 -c "import sys,json;print(json.load(sys.stdin).get('tool_input',{}).get('file_path',''))" 2>/dev/null)
[ -z "$file" ] && exit 0
case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.css|*.json|*.md) ;;
  *) exit 0 ;;
esac
[ -f "$file" ] || exit 0

# 1) Prettier owns formatting. Run it FIRST so ESLint doesn't fight it over
#    layout. --no-install: stay silent if it isn't installed yet; never block.
npx --no-install prettier --write "$file" >/dev/null 2>&1 || true

# 2) ESLint --fix owns correctness (dead imports, prefer-const, ...). Only on
#    code files; eslint-config-prettier keeps it from re-touching layout.
case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs)
    npx --no-install eslint --fix "$file" >/dev/null 2>&1 || true ;;
esac
exit 0
